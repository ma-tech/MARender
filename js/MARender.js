/**
* @file         MARender.js
* @author       Bill Hill
* @date         June 2015
* @version      $Id$
* @par
* Address:
*               MRC Human Genetics Unit,
*               MRC Institute of Genetics and Molecular Medicine,
*               University of Edinburgh,
*               Western General Hospital,
*               Edinburgh, EH4 2XU, UK.
* @par
* Copyright (C), [2015],
* The University Court of the University of Edinburgh,
* Old College, Edinburgh, UK.
* 
* This program is free software; you can redistribute it and/or
* modify it under the terms of the GNU General Public License
* as published by the Free Software Foundation; either version 2
* of the License, or (at your option) any later version.
*
* This program is distributed in the hope that it will be
* useful but WITHOUT ANY WARRANTY; without even the implied
* warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
* PURPOSE.  See the GNU General Public License for more
* details.
*
* You should have received a copy of the GNU General Public
* License along with this program; if not, write to the Free
* Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
* Boston, MA  02110-1301, USA.
* @brief	A simple renderer based on three.js which is aimed
* 		web based visualisation of 3D anatomy and gene expression.
*/

import * as THREE from './three.module.js';
import {TrackballControls} from './TrackballControls.js';
import {MAVTKLoader} from './MAVTKLoader.js';
import {STLLoader} from './STLLoader.js';
import {LineSegments2} from './LineSegments2.js';
import { LineMaterial } from './LineMaterial.js';
import { LineGeometry } from './LineGeometry.js';
import {EffectComposer} from './EffectComposer.js';
import {RenderPass} from './RenderPass.js';
import {ShaderPass} from './ShaderPass.js';
import {UnrealBloomPass} from './UnrealBloomPass.js';

/* globals XMLHttpRequest, console, document  */

/**
* Rendering modes
*/
const MARenderMode = {
  BASIC:                0,
  WIREFRAME:            1,
  LAMBERT:              2,
  PHONG:                3,
  EMISSIVE:             4,
  POINT:		5,
  SECTION:		6,
  MARKER:		7,
  LABEL:		8,
  PATH:			9,
  SHAPE:	       10
};

const MARenderShape = {
  DISC:			0
};

/**
* Properties which may be set when adding or updating a model.
*/
class MARenderItem {
  constructor() {
    this.name           = undefined;
    this.path           = undefined;
    this.color          = 0xffffff;
    this.side		= THREE.FrontSide; /* Double sided can cause artifacts
						so only use if needed. */
    this.extrude      	= 1.0;
    this.transparent    = false;
    this.opacity        = 1.0;
    this.mode           = MARenderMode.PHONG;
    this.vertices	= undefined;
    this.tangents       = undefined;
    this.normals        = undefined;
    this.normal		= new THREE.Vector3(0, 0, 1);
    this.position	= new THREE.Vector3(0, 0, 0);
    this.linewidth	= 1.0;
    this.text		= undefined;
    this.texture	= undefined;
    this.visible        = true;
    this.clipplane      = undefined;
    this.size           = 1.0;
    this.segments	= 31;
    this.style		= MARenderShape.DISC;
    this.bloom		= false;
  }
}

/**
* Font description.
*/
class MARenderFont {
  constructor() {
    this.family		= 'Arial';
    this.weight		= 'Bold';
    this.size		= 64;
  }
}

/**
* Paths.
*/

class MARenderPath extends LineSegments2 {
  constructor(geom, mat) {
    super(geom, mat);
    this.type = 'MARenderPath';
    this.isMARenderPath = true;
  }
}
MARenderPath.prototype.isMARenderPath = true;

class MARenderPathMaterial extends LineMaterial {
  constructor(prop) {
    super(prop);
    this.type = 'MARenderPathMaterial';
  }
}
MARenderPathMaterial.prototype.isPathMaterial = true;

/**
* Marker material.
*/
class MARenderMarkerMaterial extends THREE.SpriteMaterial {
  constructor(args) {
    super(args);
  }
}

/**
* Label material
*/
class MARenderLabelMaterial extends MARenderMarkerMaterial  {
  constructor(args) {
    let text = args.text;
    if(text) {
      delete args.text;
    }
    super(args);
    this.text = text;
  }
}

/**
* Bloom pass shader material
*/
class FinalBloomShaderPass extends THREE.ShaderMaterial {
  constructor(bloomComposer) {
    let vertexShader = [
      'varying vec2 vUv;',
      'void main() {',
        'vUv = uv;',
        'gl_Position = projectionMatrix * modelViewMatrix * ' +
                       'vec4(position, 1.0);',
      '}'
    ].join('\n');
    let fragmentShader = [
      'uniform sampler2D baseTexture;',
      'uniform sampler2D bloomTexture;',
      'varying vec2 vUv;',
      'void main() {',
        'gl_FragColor = (texture2D(baseTexture, vUv) + vec4(1.0) * ' +
                        'texture2D(bloomTexture, vUv));',
      '}'
    ].join('\n');
    super({
      uniforms: {
        baseTexture: {value: null},
        bloomTexture: {value: bloomComposer.renderTarget2.texture}
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      defines: {}});
    this.type = 'FinalBloomShaderPass';
    this.needsSwap = true;
  }
};

class FinalBloomPass extends ShaderPass {
  constructor(params) {
    let fbsp = new FinalBloomShaderPass(params);
    super(fbsp, 'baseTexture');
  }
};

const MARenderLayer = {
  MAIN:			0,
  BLOOM:		1
};

/**
* Enough of a camera state to restore position.
*/
class MARenderCameraState {
  constructor() {
    this.up  = new THREE.Vector3(0, 0, 1);
    this.pos = new THREE.Vector3(0, 0, 0);
    this.target = new THREE.Vector3(0, 0, 0);
  }
}

/**
* Point rendering material
*/
class AlphaPointsMaterial extends THREE.ShaderMaterial {
  constructor(params) {
    let vertexShader = [
      //AlphaPoint vertex shader
      'attribute float sizes;',
      'attribute float opacities;',
      'attribute vec3 colors;',
      'uniform float scale;',
      'varying vec3 vColor;',
      'varying float vOpacity;',
      '#include <common>',
      //'#include <logdepthbuf_pars_vertex>',
      '#include <clipping_planes_pars_vertex>',
      'void main() {',
	'vColor = colors;',
	'vOpacity = opacities;',
	'#include <begin_vertex>',
	'#include <project_vertex>',
	'gl_PointSize = 512.0 * sizes * scale / length(mvPosition.xyz);',
	'#include <clipping_planes_vertex>',
      '}'
    ].join('\n');
    let fragmentShader = [
      //AlphaPoint fragment shader
      'uniform vec3 diffuse;',
      'uniform float opacity;',
      'uniform float alphaTest;',
      'uniform sampler2D map;',
      'varying vec3 vColor;',
      'varying float vOpacity;',
      '#include <common>',
      '#include <clipping_planes_pars_fragment>',
      'void main() {',
	'#include <clipping_planes_fragment>',
	'gl_FragColor = vec4(diffuse * vColor, opacity * vOpacity);',
	'gl_FragColor = gl_FragColor * texture2D(map, gl_PointCoord);',
	'if(gl_FragColor.a < alphaTest) {',
	  'discard;',
	'}',
      '}'
    ].join('\n');
    let splitParam = [ {
      uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib['points']),
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    }, {}];
    for(let p in params) {
      switch(p) {
	case 'map':
	case 'color':
	case 'alphaTest':
	  splitParam[1][p] = params[p];
	  break;
	case 'scale':
	case 'size':
	  splitParam[1]['scale'] = params[p];
	  break;
	default:
	  splitParam[0][p] = params[p];
	  break;
      }
    }
    super(splitParam[0]);
    this.type = 'AlphaPointsMaterial';
    this.uniforms.alphaTest.value = 1.0 / 255.0;
    for(let p in splitParam[1]) {
      switch(p) {
	case 'color':
	  this.uniforms.diffuse.value = new THREE.Color(
						splitParam[1]['color']);
	  break;
	case 'map':
	  this.uniforms.map.value = splitParam[1]['map'];
	  break;
	case 'scale':
	  this.uniforms.scale.value = splitParam[1]['scale'];
	  break;
        case 'alphaTest':
	  this.uniforms.alphaTest.value = splitParam[1]['alphaTest'];
          break;
      }
    }
  }
}

/**
* @class	MARenderBloom
* @constructor
* @brief	Creates a multi pass render to enable bloom rendering.
*/
class MARenderBloom {
  constructor() {
    this.layer = undefined;
    this.bloomComposer  = undefined;
    this.finalPass = undefined;
    this.finalComposer = undefined;
    this.size = undefined;
    this.pixelRatio = undefined;
    this.strength = 2;
    this.radius = 0.2;
    this.threshold = 0;
  }


  /**
   * @class	MARenderBloom
   * @function	init
   * @brief	Sets up the multi pass render for bloom rendering.
   * @param	scene		The scene to be rendered.
   * @param	camera		The camera.
   * *param	renderer	The renderer.
   */
  init(scene, camera, renderer) {
    this.size = renderer.getSize(new THREE.Vector2());
    this.pixelRatio = renderer.getPixelRatio();
    let renderPass = new RenderPass(scene, camera);
    let bloomPass = new UnrealBloomPass(this.size, this.strength, this.radius,
        this.threshold);
    this.layer = new THREE.Layers();
    this.layer.set(MARenderLayer.BLOOM);
    this.bloomComposer  = new EffectComposer(renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(renderPass);
    this.bloomComposer.addPass(bloomPass);
    let finalPass = new FinalBloomPass(this.bloomComposer);
    this.finalComposer = new EffectComposer(renderer);
    this.finalComposer.addPass(renderPass);
    this.finalComposer.addPass(finalPass);
  }

  /**
   * @class	MARenderBloom
   * @function	update
   * @brief	Updates the multi pass bloom rendering following a window
   * 		size change.
   * @param	renderer	The renderer.
   */
  update(renderer) {
    const size = renderer.getSize(new THREE.Vector2());
    const pixelRatio = renderer.getPixelRatio();
    if((size.x != this.size.x) || (size.y  != this.size.y)) {
      this.size = size;
      this.bloomComposer.setSize(size.x, size.y);
      this.finalComposer.setSize(size.x, size.y);
    }
    if(pixelRatio !== this.pixelRatio) {
      this.pixelRatio = pixelRatio;
      this.bloomComposer.setPixelRatio(pixelRatio);
      this.finalComposer.setPixelRatio(pixelRatio);
    }
  }

  /**
   * @class	MARenderBloom
   * @function	render
   * @brief	Renders the scene using multi pass bloom rendering.
   * 		size change.
   * @param	scene		The scene to be rendered.
   * @param	camera		The camera.
   */
  render(scene, camera) {
    const objVisability = [];

    scene.traverseVisible(function(obj) {
      this._switchNonBloomedVisability(obj, objVisability, true);
    }.bind(this));
    this.bloomComposer.render(scene, camera);
    scene.traverse(function(obj) {
      this._switchNonBloomedVisability(obj, objVisability, false);
    }.bind(this));
    this.finalComposer.render(scene, camera);
  }

  /**
   * @class	MARenderBloom
   * @function	destroy
   * @brief	Destroys the multi pass bloom rendering. Not implemented.
   */
  destroy() {
    // Unimplemented
  }

  /**
   * @class	MARenderBloom
   * @function	_switchNonBloomedVisability
   * @brief	Switches the visability of mesh objects to either hide
   * 		or restore them.
   * @param	obj		Scene object.
   * @param 	visability	Table of saved object visability values.
   * @param	hide		True to hide, false to restore.
   */
  _switchNonBloomedVisability(obj, visability, hide) {
    if(hide) {
      if((obj.isMesh || obj.isMARenderPath || obj.isPoints || obj.isSprite) &&
         (this.layer.test(obj.layers) === false)) {
        visability[obj.uuid] = obj.material.visible;
        obj.material.visible = false;
      }
    } else {
      if(typeof visability[obj.uuid] !== 'undefined') {
        obj.material.visible = visability[obj.uuid];
      }
    }
  }
}

/**
* @class	MARenderer
* @constructor
* @brief 	Creates a new renderer.
* @param win	The window used by the renderer.
* @param con	The container used by the renderer. A new div for the
* 		renderer will be created within this container.
*/
class MARenderer {
  constructor(win, con) {
    this.type = 'MARenderer';
    Object.defineProperty(this, 'version', {value: '2.1.0', writable: false});
    this.win = win;
    this.con = con;
    this.scene = undefined;
    this.ambLight = undefined;
    this.dirLight = undefined;
    this.pntLight = undefined;
    this.camera = undefined;
    this.cameraControls = undefined;
    this.renderer = undefined;
    this.animCount = 0;  // Used to count animation frames since mouse movement
    this.pointSize = 10;
    this.markerSize = 50;
    this.mousePos = new THREE.Vector2(0,0);
    this.pickOfs = 0;
    this.nearPlane = 1;
    this.farPlane = 10000;
    this.setCamOnLoad = true;
    this.setHomeOnLoad = true;
    this.useCameraControl = true;
    this.conOffset = new THREE.Vector2(0,0);
    this.cameraPos = new THREE.Vector3(0, 0, 10000);
    this.center   = new THREE.Vector3(0, 0, 0);
    this.homeCameraView = new MARenderCameraState();
    this.saveCameraView = new MARenderCameraState();
    this.eventHandler = new THREE.EventDispatcher();
    this.noClipPlanes = Object.freeze([]);
    this.globalClipping = false;
    this.globalClipPlanes = this.noClipPlanes;
    this.markerAspect = [0.3, 1.0];
    this.labelFont = new MARenderFont();
    this.pickTimestamp = 0;
    this.pickMaxPointerDelay = 300; // ms max delay between down/up for picking
    this.bloom = undefined;
    THREE.ImageUtils.crossOrigin = ''; // To allow CORS textures
  }


  init() {
    this.scene = new THREE.Scene();

    this.setConOffset();
    this.camera = new THREE.PerspectiveCamera(25,
				   this.con.clientWidth / this.con.clientHeight,
				   this.nearPlane, this.farPlane);

    this.camera.updateProjectionMatrix();
    this.cameraControls = this._makeCameraControls();

    this.renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
    this._setRendererSize(this.con.clientWidth, this.con.clientHeight);
    this.con.appendChild(this.renderer.domElement);

    this.scene.add(this.camera);

    this.ambLight = new THREE.AmbientLight(0x777777);
    this.dirLight = new THREE.DirectionalLight(0x777777);
    this.dirLight.position.set(0, 0, 1);
    this.pntLight = new THREE.PointLight(0x333333, 1, 10000);
    this.pntLight.position.set(0, 0.5, 0);
    this.scene.add(this.pntLight);
    this.camera.add(this.ambLight);
    this.camera.add(this.dirLight);

    this.raycaster = new THREE.Raycaster();

    if(this.bloom) {
      this.bloom.init(scene, camera, renderer);
    }

    this.win.addEventListener('mousemove', this._trackMouse.bind(this), false);
    this.win.addEventListener('keypress', this._keyPressed.bind(this), false);
    this.win.addEventListener('resize', this._windowResize.bind(this), false);
  }

  /**
   * @class	MARenderer
   * @return	True if local clipping is on or false if it's off.
   * @function	setClipping
   * @brief	Sets the local (per model) clipping on or off.
   */
  setLocalClipping(state) {
    this.renderer.localClippingEnabled = Boolean(state);
  }

  /**
   * @class	MARenderer
   * @function	setClipping
   * @brief	Gets the state of local (per model) clipping (on or off).
   * @param state	Local clipping on if true or off if false.
   */
  getLocalClipping() {
    return(this.renderer.localClippingEnabled);
  }

  /**
   * @class	MARenderer
   * @function	setClipping
   * @brief	Sets the global clipping plane on or off.
   * @param state	Clipping plane on if true or off if false.
   */
  setGlobalClipping(state) {
    this.globalClipping = Boolean(state);
    if(this.globalClipping) {
      this.renderer.clippingPlanes = this.globalClipPlanes;
    } else {
      this.renderer.clippingPlanes = this.noClipPlanes;
    }
    this.render();
  }

  /**
   * @class	MARenderer
   * @function	setBloom
   * @brief	Sets whether bloom can be used by the renderer.
   * @param state	Bloom used if true or not used if false.
   */
  setBloom(state) {
    if(state && (typeof this.bloom === 'undefined')) {
      this._setupBloom(state);
    } else if (!state && (typeof this.bloom !== 'undefined')) {
      this._setupBloom(state);
    }
  }

  /**
   * @class	MARenderer
   * @function	getBloom
   * @return	True if bloom has been enabled for the renderer.
   * @brief	Gets whether bloom can be used by the renderer.
   */
  getBloom() {
    return(typeof this.bloom !== 'undefined');
  }

  /**
   * @class	MARenderer
   * @function	setClipping
   * @brief	Sets the global clipping plane.
   * @param pln		New clipping plane.
   */
  setGlobalClipPlane(pln) {
    if(Boolean(pln) && (pln instanceof THREE.Plane)) {
      this.globalClipPlanes = [pln];
      if(this.globalClipping) {
        this.renderer.clippingPlanes = this.globalClipPlanes;
      }
      this.render();
    }
  }

  /**
   * @class     MARenderer
   * @function	setPickOfs
   * @brief	Adds an offset to the mouse coords to compensate for title
   *            div above the canvas. For backwards compatability only.
   * @param ofs	height of title div in pixels
   */
  setPickOfs(ofs) {
     let iofs;
     let innerH;

     innerH = this.win.innerHeight;
     if(ofs !== undefined) {
        iofs = parseInt(ofs, 10);
        this.pickOfs = (iofs / innerH) * 2;
     }
  }

  /**
   * @class     MARenderer
   * @function	addModel
   * @brief	Adds a new model to the renderer using the given properties.
   * @param gProp	Model properties which conform to MARenderItem and
   * 			must include a unique name.
   */
  addModel(gProp) {
    this.makeLive();
    let itm = this._makeRenderItem(gProp);
    if(itm) {
      let mat, geom;
      switch(Number(itm.mode)) {
	case MARenderMode.BASIC:
	case MARenderMode.WIREFRAME:
	case MARenderMode.LAMBERT:
	case MARenderMode.PHONG:
	case MARenderMode.EMISSIVE:
	case MARenderMode.POINT:
	  if(itm.path) {
            let loader;
	    let ext = itm.path.split('.').pop();
	    if(ext === 'stl') {
	      loader = new STLLoader();
	    } else if(ext === 'vtk') {
	      loader = new MAVTKLoader();
	    } else {
	      console.log('MARenderer.addModel() unknown file type: ' + ext);
	    }
	    loader.load(itm.path,
	      function(geom) {
		mat = this._makeMaterial(geom, itm);
		if(mat) {
		  switch(Number(itm.mode)) {
		    case MARenderMode.POINT:
		      let pnts = new THREE.Points(geom, mat);
		      pnts.name = itm.name;
		      this.setObjBloom(pnts, itm.bloom);
		      this.scene.add(pnts);
		      break;
		    default:
		      let mesh = new THREE.Mesh(geom, mat);
		      mesh.name = itm.name;
		      this.setObjBloom(mesh, itm.bloom);
		      this.scene.add(mesh);
		      break;
		  }
		  if(this.setCamOnLoad) {
		    this._computeCenter();
		    this.setCamera();
		  }
		  if(this.setHomeOnLoad) {
		    this.setHome();
		  }
		  this.makeLive();
		}
	      }.bind(this),
	      function(){},
	      function() {
		console.log('MARenderer.addModel() geometry load failed: ' +
		            itm.path);
	      });
	  }
	  break;
	case MARenderMode.SECTION:
	  if(itm.texture) {
	    let loader = new THREE.TextureLoader();
	    loader.crossOrigin = '';
	    loader.load(itm.texture,
		 function(tx) {
		   geom = this.makeSectionGeometry(itm.vertices);
		   mat = this._makeMaterial(geom, itm);
		   tx.flipY = false;
		   tx.minFilter = THREE.LinearFilter;
		   tx.needsUpdate = true;
		   mat.map = tx;
		   let pln = new THREE.Mesh(geom, mat);
		   pln.name = itm.name;
		   this.setObjBloom(pln, itm.bloom);
		   this.scene.add(pln);
		   this.makeLive();
		 }.bind(this),
		 function() {
		   console.log('MARenderer.addModel() texture load failed: ' +
			       itm.texture);
		 });
	  }
	  break;
	case MARenderMode.MARKER:
	case MARenderMode.LABEL:
	  geom = undefined;
	  mat = this._makeMaterial(geom, itm);
	  let mrk = new THREE.Sprite(mat);
	  if(itm.mode == MARenderMode.LABEL) {
	    mrk.scale.set(this.markerSize, this.markerSize, 1.0);
	  } else {
	    mrk.scale.set(this.markerSize * this.markerAspect[0],
			  this.markerSize * this.markerAspect[1], 1.0);
	  }
	  mrk.name = itm.name;
	  mrk.position.set(itm.position.x, itm.position.y, itm.position.z);
	  this.setObjBloom(mrk, itm.bloom);
          this.scene.add(mrk);
	  this.makeLive();
	  break;
	case MARenderMode.PATH:
	  geom = this.makePathGeometry(itm.vertices, itm.tangents,
	  			       itm.normals);
	  mat = this._makeMaterial(geom, itm);
	  let path = new MARenderPath(geom, mat);
	  path.name = itm.name;
	  this.setObjBloom(path, itm.bloom);
	  this.scene.add(path);
	  this.makeLive();
	  break;
	case MARenderMode.SHAPE:
	  geom = this.makeShapeGeometry(itm.style, itm.size, itm.segments,
	                                itm.extrude);
	  mat = this._makeMaterial(geom, itm);
	  let shape = new THREE.Mesh(geom, mat);
	  shape.name = itm.name;
	  shape.position.set(itm.position.x, itm.position.y, itm.position.z);
	  let po = itm.position.length();
	  let d = new THREE.Vector3(itm.normal.x, itm.normal.y, itm.normal.z);
	  d.multiplyScalar(po + 1.0);
	  d.add(shape.position);
	  shape.lookAt(d);
	  this.setObjBloom(shape, itm.bloom);
	  this.scene.add(shape);
	  this.makeLive();
	  break;
	default:
	  break;
      }
    }
  }

  /**
   * @class     MARenderer
   * @function	getObjectByName
   * @return	The found object or undefined if not found.
   * @brief	Gets the named object if it exists in the scene.
   * @param name 	Name of the object to find.
   */
  getObjectByName(name) {
    return(this.scene.getObjectByName(name, true));
  }

  /**
   * @class     MARenderer
   * @function	updateModel
   * @brief	Updates an existing model of the renderer using the given
   * 		properties.
   * @param gProp	Model properties which conform to MARenderItem and
   * 			must include a unique name.
   */
  updateModel(gProp) {
    if(gProp['name']) {
      let name = gProp['name'];
      let obj = this.scene.getObjectByName(name, true);
      if(obj) {
	this._updateObj(obj, gProp);
      }
    }
    this.render();
  }

  /**
   * @class     MARenderer
   * @function  makePathGeometry
   * @return	New geometry.
   * @brief	Creates a geometry for use in rendering paths.
   * @param vtx		Array of ordered 3D vertices along the path.
   * @param tgt		Array of ordered tangents corresponding to the
   * 			given vertices along the path.
   * 			Optional, the tangents array may be undefined.
   * @param nrm 	Array of ordered (reference) normals corresponding to
   * 			the given tangents and vertices along the path.
   * 			Optional, the normals array may be undefined.
   */
  makePathGeometry(vtx, tgt, nrm) {
    let colors = [];
    let positions = [];
    let normals = [];
    let tangents = [];
    let geom = new LineGeometry();
    for(let i = 0; i < vtx.length; ++i) {
      let v = vtx[i];
      colors.push(1.0, 1.0, 1.0);
      positions.push(v[0], v[1], v[2]);
      if(tgt !== undefined) {
        let t = tgt[i];
        tangents.push(t[0], t[1], t[2]);
      }
      if(nrm !== undefined) {
        let n = nrm[i];
        normals.push(n[0], n[1], n[2]);
      }
    }
    geom.setPositions(positions);
    geom.setColors(colors);
    if(tgt !== undefined) {
      geom.setAttribute('tangent',
			new THREE.Float32BufferAttribute(tangents, 3));
    }
    if(nrm !== undefined) {
      geom.setAttribute('normal',
			new THREE.Float32BufferAttribute(normals, 3));
    }
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    return(geom);
  }

  /**
   * @class     MARenderer
   * @function	makeShapeGeometry
   * @return	New geometry.
   * @brief	Creates a new shape geometry.
   * @param	style	 The type of shape to be created.
   * @param	size	 Shape size (eg radius or width).
   * @param	segments Number of curve segments.
   * @param     extrude  Amount to extrude shape.
   */
  makeShapeGeometry(style, size, segments, extrude) {
    let geom = undefined;
    switch(style) {
      case MARenderShape.DISC:
	let shape = new THREE.Shape();
	shape.moveTo(0, 0);
	shape.absarc(0, 0, size, 0, Math.PI * 2, false);
	geom = new THREE.ExtrudeGeometry(shape,
	    {bevelEnabled: false, depth: extrude, curveSegments: segments});
        break;
      default:
        break;
    }
    return(geom);
  }

  /**
   * @class	MARenderer
   * @function	makeSectionGeometry
   * @return	New geometry.
   * @brief	Create a geometry for use in rendering planar sections.
   * @param vertices	Array of four ordered 3D vertices at the position
   * 			of the rectangular sections corners.
   */
  makeSectionGeometry(vertices) {
    const geom = new THREE.BufferGeometry();
    let vtx;
    let idx = [0, 1, 2, 2, 3, 0];
    let uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    if(vertices) {
      vtx = [];
      for(let i = 0; i < vertices.length; ++i) {
	let v = vertices[i];
        vtx.push(v.x, v.y, v.z);
      }
    } else {
      vtx = [0, 0, 0,   1, 0, 0,   1, 1, 0,   0, 1, 0];
    }
    geom.setAttribute('position',
                      new THREE.Float32BufferAttribute(vtx, 3));
    geom.setAttribute('uv',
                      new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    return(geom);
  }

  /**
   * @class	MARenderer
   * @function	makePlaneFromAngles
   * @return	New plane.
   * @brief	Create a plane using sectioning angles, a fixed point
   * 		and a distance from the fixed point ass as used in
   * 		Woolz and WlzIIPSrv.
   * @param pitch	Pitch angle.
   * @param yaw		Yaw angle.
   * @param fixed 	Fixed point.
   * @param dst		Prependicular distance from the fixed point to the
   * 			plane.
   */
  makePlaneFromAngles(pit, yaw, fxd, dst) {
    let cp = Math.cos(pit);
    let cy = Math.cos(yaw);
    let sp = Math.sin(pit);
    let sy = Math.sin(yaw);
    let nrm = new THREE.Vector3(sp * cy, sp * sy, cp);
    dst += (fxd.x * nrm.x) + (fxd.y * nrm.y) + (fxd.z * nrm.z);
    let pln = new THREE.Plane(nrm, -dst);
    return(pln);
  }

  /**
   * @class	MARenderer
   * @function	setConOffset
   * @brief	Sets the offset of the container from the window.
   */
  setConOffset() {
    /*
    let c = this.con;
    let o = new THREE.Vector2(0, 0);
    while(c) {
      o.x += c.offsetLeft;
      o.y += c.offsetTop;
      c = c.offsetParent;
    }
    this.conOffset.copy(o);
    */
  }

  /**
   * @class	MARenderer
   * @function	setObjBloom
   * @brief	Sets the objects bloom state to on if state is true or off if
   * 		state is false.
   * @param	obj		Object to set bloom state on.
   * @param	state		Boolean.
   */
  setObjBloom(obj, state) {
    if(obj) {
      if(state) {
	obj.layers.enable(MARenderLayer.BLOOM);
      } else {
	obj.layers.disable(MARenderLayer.BLOOM);
      }
    }
  }

  /**
   * @class	MARenderer
   * @function	getObjBloom
   * @return	Undefined if obj is invalid else true if bloom is on
   * 		or false if bloom is off.
   * @brief	Gets the objects bloom state.
   * 		state is false.
   * @param	obj		Object to get bloom state of.
   */
  getObjBloom(obj) {
    let state = undefined;
    if(obj) {
      state = obj.layers.isEnabled(MARenderLayer.BLOOM);
    }
    return(state);
  }

  /**
   * @class     MARenderer
   * @function  setLineResolution
   * @brief     Sets the resolution for all line materials. This is required
   * 		for LineMaterial.
   * @param	w	Window width.
   * @param	h	Window height.
   */
  setLineResolution(w, h) {
    for(let i = 0, l = this.scene.children.length; i < l; i ++ ) {
      let child = this.scene.children[i];
      if(child && (child.type === 'MARenderPath') &&
         child.material && (child.material.type === 'MARenderPathMaterial')) {
	child.material.resolution.set(w, h);
      }
    }
  }


  /**
   * @class	MARenderer
   * @function	makePlaneFromVertices
   * @return	New plane.
   * @brief	Create a plane using the first three vertices of the given
   * 		array of 3D vertices.
   * @param vtx		Array of vertices.
   */
  makePlaneFromVertices(vtx) {
    let pln;
    if(vtx && (vtx instanceof Array) && (vtx.length >= 3)) {
      pln = new THREE.Plane();
      pln.setFromCoplanarPoints (vtx[0], vtx[1], vtx[2]);
    }
    return(pln);
  }

  /**
   * @class	MARenderer
   * @function	setCamera
   * @brief	Sets the camera for the renderer.
   * @param cen		Centre of the scene.
   * @param near	Camera near plane.
   * @param far		Camera far plane.
   * @param pos		Camera position.
   */
  setCamera(cen, near, far, pos) {
    if(cen || near || far || pos) {
      this.setCamOnLoad = false;
      if(cen) {
	this.center.copy(cen);
      }
      if(near) {
	this.nearPlane = near;
      }
      if(far) {
	this.farPlane = far;
      }
      if(pos) {
	this.cameraPos.copy(pos);
      }
    } else {
      this._computeCenter();
    }
    this.camera.near = this.nearPlane;
    this.camera.far = this.farPlane;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.cameraPos);
  }

  /**
   * @class	MARenderer
   * @function	setHome
   * @brief	Sets the camera home position.
   * @param pos		Given camera home position, default is the current
   * 			camera trackball position.
   * @param up		Given camera up vector, default is the current
   * 			camera trackball up vector.
   */
  setHome(pos, up) {
    if(this.cameraControls) {
      if(pos || up) {
	this.setHomeOnLoad = false;
      }
      if(pos === undefined) {
	pos = this.cameraControls.object.position.clone();
      }
      if(up === undefined) {
	up = this.cameraControls.object.up.clone();
      }
      this.homeCameraView.up.copy(up);
      this.homeCameraView.pos.copy(pos);
      this.goHome();
    }
  }

  /**
   * @class	MARenderer
   * @function	goHome
   * @brief	Moves the camera trackball to the current home position.
   */
  goHome() {
    if(this.cameraControls) {
      this.cameraControls.up0.copy(this.homeCameraView.up);
      this.cameraControls.position0.copy(this.homeCameraView.pos);
      this.cameraControls.target0.copy(this.center);
      this.cameraControls.reset();
    }
  }

  /**
   * @class	MARenderer
   * @function	removeModel
   * @brief	Removes the named model and frees its resources.
   * @param name	Given model name.
   */
  removeModel(name) {
    let obj = this.scene.getObjectByName(name, true);
    if(obj) {
      this.scene.remove(obj);
      if(obj.material) {
        obj.material.dispose();
      }
      if(obj.geometry) {
        obj.geometry.dispose();
      }
      this.render();
    }
  }

  /**
   * @class	MARenderer
   * @function	getChildren
   * @brief	Gets the children of the scene.
   */
  getChildren() {
    return this.scene.children;
  }

  /**
   * @class	MARenderer
   * @function	handleWindowResize
   * @brief	Handles window resize.
   */
  handleWindowResize() {
    this.setConOffset();
    this.camera.aspect = this.con.clientWidth / this.con.clientHeight;
    this.camera.updateProjectionMatrix();
    this._setRendererSize(this.con.clientWidth, this.con.clientHeight);
    if(this.cameraControls) {
      this.cameraControls.handleResize();
    }
    if(this.bloom) {
      this.bloom.update(this.renderer);
    }
  }

  /**
   * @class	MARenderer
   * @function	opacityIncrement
   * @brief	Increments the opacity of all transparent models.
   * @param inc		Opacity increment which may be positive or
   * 			negative.
   */
  opacityIncrement(inc) {
    let update = false;
    for(let i = 0, l = this.scene.children.length; i < l; i ++ ) {
      let child = this.scene.children[i];
      if(child && (child.type === 'Mesh')) {
        if(child.material && child.material.transparent &&
	   (child.material.opacity != undefined)) {
	  let op = child.material.opacity;
	  let tr = child.material.transparent;
	  if((inc > 0.0) && (op < inc)) {
	    op = inc;
	  }
	  else {
	    op = op * (1.0 + inc);
	  }
	  op = this._opacityClamp(op);
	  this._setMaterialOpacity(child.material, tr, op);
	  child.material.needsUpdate = true;
	}
      }
    }
    if(update) {
      this.render();
    }
  }

  /**
   * @class	MARenderer
   * @function	pointSizeSet
   * @brief	Sets the current default point size and the point size of
   * 		all point cloud models.
   * @param sz		Given point size. By default the current point size
   * 			is used.
   */
  pointSizeSet(sz) {
    let update = false;
    if(sz !== undefined) {
      this.pointSize = this._pointSizeClamp(sz);
    }
    for(let i = 0, l = this.scene.children.length; i < l; i ++ ) {
      let child = this.scene.children[i];
      if(child && (child.type === 'Points')) {
	let mat = child.material;
	if(mat) {
	  if(mat.type == 'PointsMaterial') {
	    update = true;
	    mat.needsUpdate = true;
	    mat.size = this.pointSize;
	  }
	  else if(mat.type =='AlphaPointsMaterial') {
	    update = true;
	    mat.needsUpdate = true;
	    mat.uniforms.scale.value = this.pointSize;
	  }
	}
      }
    }
    if(update) {
      this.render();
    }
  }

  /**
   * @class	MARenderer
   * @function	pointSizeIncrement
   * @brief	Increments the point size of all point cloud models.
   * @param inc		Increment which may be positive or negative.
   */
  pointSizeIncrement(inc) {
    this.pointSize = this._pointSizeClamp(this.pointSize * (1.0 + inc));
    this.pointSizeSet();
  }

  /**
   * @class	MARenderer
   * @function	pointSizeSet
   * @brief	Sets the current default marker size and the marker size of
   * 		all marker models.
   * @param sz		Given marker size. By default the current marker size
   * 			is used.
   */
  markerSizeSet(sz) {
    let update = false;
    if(sz !== undefined) {
      this.markerSize = this._markerSizeClamp(sz);
    }
    if((this.scene  !== undefined) && (this.scene.children !== undefined)) {
      for(let i = 0, l = this.scene.children.length; i < l; i ++ ) {
	let child = this.scene.children[i];
	if(child && (child.type === 'Sprite')) {
	  if(child.material.text !== undefined) {
	    child.scale.set(this.markerSize, this.markerSize, 1.0);
	  } else {
	    child.scale.set(this.markerSize * this.markerAspect[0],
			    this.markerSize * this.markerAspect[1], 1.0);
	  }
	}
      }
    }
    if(update) {
      this.render();
    }
  }

  /**
   * @class	MARenderer
   * @function	render
   * @brief	Renders the scene now.
   */
  render() {
    if(this.bloom) {
      this.bloom.render(this.scene, this.camera);
    } else {
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * @class	MARenderer
   * @function	setCameraControl
   * @brief	Sets camera control by the trackball on or off.
   */
  setCameraControl(state) {
    let newState = Boolean(state);
    if(newState != this.useCameraControl) {
      if(this.useCameraControl) {
	if(this.cameraControls) {
	  this.saveCameraView.up.copy(this.cameraControls.object.up.clone());
	  this.saveCameraView.pos.copy(
		  this.cameraControls.object.position.clone());
	  this.saveCameraView.target.copy(this.center);
	  this.cameraControls.enabled = false;
	}
      } else {
	this.cameraControls = this._makeCameraControls();
	this.cameraControls.enabled = true;
	this.cameraControls.up0.copy(this.saveCameraView.up);
	this.cameraControls.position0.copy(this.saveCameraView.pos);
	this.cameraControls.target0.copy(this.saveCameraView.target);
	this.cameraControls.reset();
      }
      this.useCameraControl = newState;
    }
  }

  /**
   * @class	MARenderer
   * @function	setCameraControl
   * @brief	Gets camera control by the trackball state.
   */
  getCameraControl() {
    return(this.useCameraControl);
  }

  /**
   * @class	MARenderer
   * @function	animate
   * @brief	Starts rendering the scene. The rendering will be repeated
   * 		under the control of a timer and following mouse movement
   * 		or scene updates.
   */
  animate() {
    let anim = this.animate.bind(this);
    let aid = this.win.requestAnimationFrame(anim);
    if(this.useCameraControl && this.cameraControls) {
      this.cameraControls.update();
      if(this.animCount == 0) {
        this.handleWindowResize();
      }
    }
    let rend = this.render.bind(this);
    rend();
    if((this.scene.children.length < 1) || (++(this.animCount) > 200)) {
      this.win.cancelAnimationFrame(aid);
    }
  }

  /**
   * @class	MARenderer
   * @function	makeLive
   * @brief	Makes sure that the scene is rendered and resets the
   * 		rendering timer.
   */
  makeLive() {
    let count = this.animCount;
    this.animCount = 0;
    if(count > 200) {
      this.animate();
    }
  }

  /**
   * @class 	MARenderer
   * @function	addEventListener
   * @brief	Adds the event listener.
   * @param type	Event type.
   * @param listener	The event listener function.
   */
  addEventListener(type, listener) {
    this.eventHandler.addEventListener(type, listener);
  }

  /**
   * @class 	MARenderer
   * @function	removeEventListener
   * @brief	Removes the event listener.
   * @param type	Event type.
   * @param listener	The event listener function.
   */
  removeEventListener(type, listener) {
    this.eventHandler.removeEventListener(type, listener);
  }

  /**
   * @class	MARenderer
   * @function	getIIP3DBBVertices
   * @brief	Get vertices of the section defined by the IIP3D request
   *            encoded in the given URL using voxel scaling.
   * @param url		The IIP3D URL which should define the section but
   *                    not include an OBJ, CVT or tile request.
   * @param vsz		The voxel size, supplied as a THREE.Vector3().
   */
  getIIP3DBBVertices(url, vsz) {
    let prmX = [0, 1, 1, 0];
    let prmY = [0, 0, 1, 1];
    let max = new THREE.Vector2();
    let vtx = [new THREE.Vector3(), new THREE.Vector3(),
	       new THREE.Vector3(), new THREE.Vector3()];
    let req = new XMLHttpRequest();
    req.open('GET', url + '&OBJ=Wlz-true-voxel-size', false);
    req.send(null);
    req.open('GET', url + '&OBJ=Max-size', false);
    req.send(null);
    if(req.status === 200) {
      // rsp = Max-size:321 173
      let rsp = req.responseText.split(':')[1].split(' ');
      max.x = rsp[0] - 1.0;
      max.y = rsp[1] - 1.0;
    }
    for(let idx = 0; idx < 4; ++idx) {
      req.open('GET', url + '&PRL=-1,' +
	       prmX[idx] * max.x + ',' +
	       prmY[idx] * max.y +
               '&OBJ=Wlz-coordinate-3D', false);
      req.send(null);
      if(req.status === 200) {
	let rsp = req.responseText.split(':')[1].split(' ');
	vtx[idx].set(rsp[0] * vsz.x, rsp[1] * vsz.y, rsp[2] * vsz.z);
      }
    }
    return(vtx);
  }

  /**
   * @class     MARenderer
   * @return	Clamped value.
   * @function  _clamp
   * @brief	Clamps the given value to the given range.
   * @param	v	Given value.
   * @param	min	Minimum value.
   * @param	max	Maximum value.
   */
  static _clamp(v, min, max) {
    if(v < min) {
      v = min;
    } else if(v > max) {
      v = max;
    }
    return(v);
  }


  /**
   * @class     MARenderer
   * @function  _setRendererSize
   * @brief	Sets the renderer size.
   * @param	w	Window width.
   * @param	h	Window height.
   */
  _setRendererSize(w, h) {
    this.renderer.setSize(w, h);
    this.setLineResolution(w, h);
  }

  /**
   * @class     MARenderer
   * @return	Clamped opacity value.
   * @function  _pointSizeClamp
   * @brief	Clamps the given point size to the allowed range (0.0 - 1.0).
   * @param	op	Given opacity value.
   */
  _opacityClamp(op) {
    op = MARenderer._clamp(op, 0.0, 1.0);
    return(op);
  }

  /**
   * @class     MARenderer
   * @return	Clamped point size.
   * @function  _pointSizeClamp
   * @brief	Clamps the given point size to the allowed range.
   * @param	sz	Given point size.
   */
  _pointSizeClamp(sz) {
    sz = MARenderer._clamp(sz, 0.1, 99.9);
    return(sz);
  }

  /**
   * @class     MARenderer
   * @return	Clamped marker size.
   * @function  _markerSizeClamp
   * @brief	Clamps the given marker size to the allowed range.
   * @param	sz	Given marker size.
   */
  _markerSizeClamp(sz) {
    sz = MARenderer._clamp(sz, 0.1, 199.9);
    return(sz);
  }

  /**
   * @class	MARenderer
   * @return	New camera controls.
   * @function	_makeCameraControls
   * @brief	Initialises the camera trackball controls.
   */
  _makeCameraControls() {
    let cc = new TrackballControls(this.camera, this.con);
    cc.panSpeed = 0.3;
    cc.dynamicDampingFactor = 0.7;
    return(cc);
  }

  /**
   * @class	MARenderer
   * @function	_setMaterialOpacity
   * @brief	Sets the opacity of the given material.
   * @param mat		Given material.
   * @param tr		True if material is tranparent, if false function
   * 			simply returns.
   * @param op		Given opacity.
   */
  _setMaterialOpacity(mat, tr, op) {
    if(mat && tr) {
      if(op < 0.01) {
	mat['opacity'] = 0.0;
      } else {
	if(op > 1.0) {
	  op = 1.0;
	}
	if(op < 0.9) {
	  mat['depthWrite'] = false;
	} else {
	  mat['depthWrite'] = true;
	}
	mat['opacity'] = op;
      }
      this.render();
    }
  }

  /**
   * @class 	MARenderer
   * @function	_updateObj
   * @brief	Updates the given objects properties.
   * @param obj		Given object.
   * @param gProp	Properties to set in the given object.
   */
  _updateObj(obj, gProp) {
    this.makeLive();
    let itm = new MARenderItem();
    if(itm) {
      if(gProp['color']) {
	itm.color = gProp['color'];
      } else if(obj.material && obj.material.color) {
	itm.color = obj.material.color;
      }
      if(gProp['clipping'] !== undefined) {
        if(gProp['clipping'] instanceof THREE.Plane) {
	  let pln = new THREE.Plane().copy(gProp['clipping']);
	  itm.clipping = [pln];
        } else {
	  itm.clipping = this.noClipPlanes;
	}
      } else if(obj.material) {
	itm.clipping = obj.material.clippingPlanes;
      }
      if(gProp['opacity']) {
	itm.opacity = gProp['opacity'];
      } else if(obj.material && obj.material.opacity) {
	itm.opacity = obj.material.opacity;
      }
      if(gProp['transparent'] !== undefined) {
	itm.transparent = gProp['transparent'];
      } else if(obj.material && obj.material.transparent) {
	itm.transparent = obj.material.transparent;
      }
      if(gProp['side'] !== undefined) {
	itm.side = gProp['side'];
      } else if(obj.material) {
        itm.side = obj.material.side;
      }
      if(gProp['visible'] !== undefined) {
	itm.visible = gProp['visible'];
      } else if(obj.material) {
        itm.visible = obj.material.visible;
      }
      if(gProp['size'] !== undefined) {
	itm.size = gProp['size'];
      }
      if(gProp['extrude'] !== undefined) {
	itm.extrude = gProp['extrude'];
      }
      if(gProp['linewidth'] !== undefined) {
	itm.linewidth = gProp['linewidth'];
      } else if(obj.type === 'MARenderPath') {
        itm.linewidth = obj.material.linewidth;
      }
      if(gProp['segments'] !== undefined) {
	itm.segments = gProp['segments'];
      }
      if(gProp['texture']) {
	itm.texture = gProp['texture'].slice(0);
      }
      if(gProp['vertices']) {
	itm.vertices = gProp['vertices'].slice(0);
      }
      if(gProp['tangents']) {
	itm.tangents = gProp['tangents'].slice(0);
      }
      if(gProp['normals']) {
	itm.normals = gProp['normals'].slice(0);
      }
      if(gProp['position']) {
	itm.position = gProp['position'];
      } else if((obj.type === 'Sprite') ||
		((obj.geometry !== undefined) &&
		 (obj.geometry.type == 'ExtrudeGeometry'))) {
        itm.position = obj.position;
      }
      if(gProp['normal']) {
        itm.normal = gProp['normal'];
      }
      if(gProp['text']) {
	itm.text = gProp['text'];
      } else if((obj.type === 'Sprite') && (obj.material !== undefined) &&
                (obj.material.text !== undefined)) {
        itm.text = obj.material.text;
      }
      if(gProp['bloom']) {
        itm.bloom  = gProp['bloom'];
      }
      if(gProp['mode']) {
	// Always set the mode/material type
	let mode = this._checkRenderMode(gProp['mode']);
	if(mode) {
	  itm.mode = mode;
	}
      } else {
	if(obj.type === 'MARenderPath') {
	  itm.mode = MARenderMode.PATH;
	} else if((obj.geometry !== undefined) &&
	   (obj.geometry.type === 'ExtrudeGeometry')) {
	  itm.mode = MARenderMode.SHAPE;
	} else if(obj.type === 'Points') {
	  itm.mode = MARenderMode.POINT;
	} else if(obj.material) {
	  if(obj.material.type === 'SpriteMaterial') {
	    if(obj.material.text !== undefined) {
	      itm.mode = MARenderMode.LABEL;
	    } else {
	      itm.mode = MARenderMode.MARKER;
	    }
	  } else {
	    itm.mode = MARenderMode.SECTION;
	  }
	}
      }
    }
    switch(Number(itm.mode)) {
      case MARenderMode.BASIC:
      case MARenderMode.WIREFRAME:
      case MARenderMode.LAMBERT:
      case MARenderMode.PHONG:
      case MARenderMode.EMISSIVE:
      case MARenderMode.POINT:
        {
	  let mat = this._makeMaterial(obj.geometry, itm);
	  let oldmat = obj.material;
	  obj.material = mat;
	  if(oldmat) {
	    oldmat.dispose();
	  }
	}
	break;
      case MARenderMode.SECTION:
	{
	  obj.material.visible = itm.visible;
	  obj.material.opacity = itm.opacity;
	  if(itm.texture && itm.vertices) {
	    let loader = new THREE.TextureLoader();
	    loader.crossOrigin = '';
	    loader.load(itm.texture,
	        function (tex) {
		  // onLoad
		  let oldgeom = obj.geometry;
		  let oldtex = obj.material.map;
		  let geom = this.makeSectionGeometry(itm.vertices);
		  tex.flipY = false;
		  tex.minFilter = THREE.LinearFilter;
		  tex.needsUpdate = true;
		  obj.material.map = tex;
		  obj.geometry = geom;
		  oldtex.dispose();
		  oldgeom.dispose();
		  this.makeLive();
		}.bind(this),
		undefined,
		function() {
		  console.log('MARenderer.updateObj() texture load failed: ' +
		              itm.texture);
		});
	  }
	}
	break;
      case MARenderMode.LABEL:
      case MARenderMode.MARKER:
	{
	  let mat = this._makeMaterial(obj.geometry, itm);
	  let oldmat = obj.material;
	  obj.material = mat;
	  if(oldmat) {
	    oldmat.dispose();
	  }
	  if(itm.position) {
	    obj.position.set(itm.position.x, itm.position.y, itm.position.z);
	  }
	}
	break;
      case MARenderMode.SHAPE:
	{
	  let pos = obj.position;
	  if(itm.style || itm.size || itm.segments || itm.extrude) {
	    let oldgeom = obj.geometry;
	    let geom = this.makeShapeGeometry(itm.style, itm.size,
	                                      itm.segments, itm.extrude);
	    oldgeom.dispose();
	    obj.geometry = geom;
	  }
	  let oldmat = obj.material;
	  let mat = this._makeMaterial(obj.geometry, itm);
	  oldmat.dispose();
	  obj.material = mat;
	  if(itm.position) {
	    obj.position.set(itm.position.x, itm.position.y, itm.position.z);
	    if(itm.normal) {
	      let d = new THREE.Vector3(itm.normal.x, itm.normal.y,
	                                itm.normal.z);
	      d.add(obj.position);
	      obj.lookAt(d);
	    }
	  }
	}
        break;
      case MARenderMode.PATH:
	{
	  if(itm.vertices || itm.tangents || itm.normals) {
	    let oldgeom = obj.geometry;
	    let geom = this.makePathGeometry(itm.vertices, itm.tangents,
					     itm.normals);
	    oldgeom.dispose();
	    obj.geometry = geom;
	  }
	  let oldmat = obj.material;
	  let mat = this._makeMaterial(obj.geometry, itm);
	  oldmat.dispose();
	  obj.material = mat;
	  if(itm.visible !== undefined) {
	    obj['visible'] = itm.visible;
	  }
	}
        break;
      default:
        break;
    }
    if(typeof itm.bloom !== 'undefined') {
      if(itm.bloom) {
        obj.layers.enable(MARenderLayer.BLOOM);
      } else {
        obj.layers.disable(MARenderLayer.BLOOM);
      }
    }
  }

  /**
   * @class	MARenderer
   * @function	_updateAllMesh
   * @brief	Updates the properties of all meshes.
   * @param gProp	Given properties to update.
   */
  _updateAllMesh(gProp) {
    for(let i = 0, l = this.scene.children.length; i < l; i ++ ) {
      let child = this.scene.children[i];
      if(child && (child.type === 'Mesh')) {
        if(child.material && !(child.material.map)) {
	  this._updateObj(child, gProp);
          this.render();
        }
      }
    }
  }

  /**
   * @class	MARenderer
   * @function	_makeRenderItem
   * @return	New render item.
   * @brief	Create a new render item the given properties set.
   * 		All properties not given have the default value.
   * @param gProp	Given properties.
   */
  _makeRenderItem(gProp) {
    let ok = true;
    let itm = new MARenderItem();
    for(let p in gProp) {
      switch(p) {
        case 'name':
        case 'path':
	case 'side':
	case 'text':
	case 'position':
	case 'normal':
	  itm[p] = gProp[p];
          break;
	case 'yaw':
	case 'dist':
	case 'size':
        case 'color':
	case 'pitch':
	case 'style':
        case 'extrude':
        case 'opacity':
        case 'segments':
        case 'linewidth':
	  itm[p] = Number(gProp[p]);
          break;
	case 'bloom':
	case 'visible':
        case 'transparent':
          itm[p] = Boolean(gProp[p]);
          break;
        case 'mode':
	  {
	    let mode = this._checkRenderMode(gProp[p]);
	    if(mode) {
	      itm[p] = mode;
	    }
	  }
	  break;
	case 'texture':
	case 'tangents':
	case 'normals':
	case 'vertices':
	  itm[p] = gProp[p].slice(0);
	  break;
	case 'clipping':
	  if(gProp[p] && (gProp[p] instanceof THREE.Plane)) {
	    let pln = new THREE.Plane().copy(gProp[p]);
	    itm.clipping = [ pln ];
	  } else {
	    itm.clipping = this.noClipPlanes;
	  }
	  break;
        default:
	  ok = false;
	  console.log('MARenderer._makeRenderItem() unknown property: ' + p);
	  break;
      }
    }
    if(!ok) {
      itm = undefined;
    }
    return(itm);
  }

  /**
   * @class	MARenderer
   * @function	_checkRenderMode
   * @return	Given render mode or undefined if the render mode is invalid.
   * @brief	Checks that the given render mode is valid.
   * @param gMode	Given render mode.
   */
  _checkRenderMode(gMode) {
    let rMode = undefined;
    if(gMode) {
      switch(Number(gMode)) {
	case MARenderMode.BASIC:
	case MARenderMode.WIREFRAME:
	case MARenderMode.LAMBERT:
	case MARenderMode.PHONG:
	case MARenderMode.EMISSIVE:
	case MARenderMode.POINT:
	case MARenderMode.SECTION:
	case MARenderMode.MARKER:
	case MARenderMode.LABEL:
	case MARenderMode.PATH:
	case MARenderMode.SHAPE:
	  rMode = gMode;
	  break;
	default:
	  console.log('MARenderer: Unknown mode: ' + gMode);
	  break;
      }
    }
    return(rMode);
  }

  /**
   * @class	MARenderer
   * @function	_makeMaterial
   * @return	New material.
   * @brief	Makes a new material using the properties of the given render
   * 		item.
   * @param itm		Given render item.
   */
  _makeMaterial(geom, itm) {
    let mat;
    let sProp = {};
    if(itm.mode) {
      sProp['color'] = itm.color;
      sProp['opacity'] = itm.opacity;
      sProp['transparent'] = itm.transparent;
      sProp['visible'] = itm.visible;
      if(itm.clipping) {
	sProp['clippingPlanes'] = itm.clipping;
      }
    }
    switch(itm.mode) {
      case MARenderMode.BASIC:
	sProp['wiretrame'] = false;
	mat = new THREE.MeshBasicMaterial(sProp);
	break;
      case MARenderMode.WIREFRAME:
	sProp['wireframe'] = true;
	sProp['wireframeLinewidth'] = 1;
	mat = new THREE.MeshLambertMaterial(sProp);
	break;
      case MARenderMode.LAMBERT:
	sProp['wireframe'] = false;
	sProp['side'] = itm.side;
	mat = new THREE.MeshLambertMaterial(sProp);
	break;
      case MARenderMode.PHONG:
      case MARenderMode.SHAPE:
	sProp['specular'] = 0x111111;
	sProp['wireframe'] = false;
	sProp['side'] = itm.side;
	sProp['emissive'] = 0x000000;
	sProp['shininess'] = 25;
	this._setMaterialOpacity(sProp, itm.transparent, itm.opacity);
	mat = new THREE.MeshPhongMaterial(sProp);
	break;
      case MARenderMode.EMISSIVE:
	sProp['specular'] =0x777777;
	sProp['wireframe'] = false;
	sProp['emissive'] = itm.color;
	sProp['shininess'] = 15;
	sProp['side'] = itm.side;
	mat = new THREE.MeshPhongMaterial(sProp);
	break;
      case MARenderMode.POINT:
	{
	  sProp['size'] = this.pointSize;
	  sProp['blending'] = THREE.CustomBlending;
	  sProp['blendSrc'] = THREE.SrcColorFactor;
	  sProp['blendDst'] = THREE.DstAlphaFactor;
	  sProp['blendEquation'] = THREE.AddEquation;
	  sProp['alphaTest'] = 0.3;
	  let tx = THREE.ImageUtils.loadTexture(
	      'data:image/png;base64,' +
	      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAQAAABuBnYAAAAAAmJLR0QA/4eP' +
	      'zL8AAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfgAg8MNSkRqlGqAAAA' +
	      'VElEQVQI113NQQ0DIRBA0TcEFYQTSVWsAHRUWXUgoDY4bbAxPfS2X8D7ATk1' +
	      'nFhU8u0ysLPFp+Z0mTpe5CmaoYNuaMWj4thucNtOjZWNP+obK57bH17lGKmO' +
	      'V2FkAAAAAElFTkSuQmCC');
	  sProp['map'] = tx;
	  if((geom.attributes.colors !== undefined) &&
	     (geom.attributes.colors.array.length > 0)) {
	    mat = new AlphaPointsMaterial(sProp);
	    mat.vertexColors = THREE.VertexColors;
	  } else {
	    mat = new THREE.PointsMaterial(sProp);
	  }
	}
	break;
      case MARenderMode.PATH:
	sProp['alphaTest'] = 0.2;
	sProp['linewidth'] = itm.linewidth;
	sProp['vertexColors'] = true;
	mat = new MARenderPathMaterial(sProp);
	break;
      case MARenderMode.SECTION:
	sProp['transparent'] = itm.transparent;
	sProp['alphaTest'] = 0.2;
	sProp['wireframe'] = false;
	sProp['side'] = THREE.DoubleSide;
	mat = new THREE.MeshBasicMaterial(sProp);
	break;
      case MARenderMode.MARKER:
      case MARenderMode.LABEL:
	sProp['alphaTest'] = 0.1;
	if(itm.mode === MARenderMode.MARKER) {
	  let tx = THREE.ImageUtils.loadTexture(
	      'data:image/png;base64,' +
	      'iVBORw0KGgoAAAANSUhEUgAAAMAAAAIAAQMAAADuZfHZAAAABlBMVEUAAAD' +
	      '///+l2Z/dAAAAAXRSTlMAQObYZgAAAAFiS0dEAIgFHUgAAAAJcEhZcwAACx' +
	      'MAAAsTAQCanBgAAAAHdElNRQfkCRUQCRIVi1+ZAAADLUlEQVRo3u2ZQZKjM' +
	      'AxFoVh46SNwFB8NH81H8RFYsnDZPckEkGR9AjXVmyn9VVdeEvsrWJbUw3Cq' +
	      'tThoak0n8wuU/vWxvZX0D7S2qSu8JF+fdpD1b+qXX5r+Xcc3yX35E6wMhBM' +
	      'UsARfZCSvs0UcBVlfm0clUFDB2nR1tjb9tSYOsr429T5zsOmbotvimyLbEq' +
	      '8f2xolSFqk6H69BKu+23O/QYICdnsY6UADNnYjYw+SFvTTiOvBqvvbwdyDD' +
	      'YGiG98dLgg0RRBE3fhf69N3kEYWE0fsehVEspGVhKrQKGwEZBrpjbwp0h+t' +
	      'nKGq7PcnoLBnrJ7vWdnjSkDmp+7ceuRP/gnEIYo7qOLYxf2zRRzUtINNHO2' +
	      '0b2MViegAWWSJvP+RRF7J+0ejONsHkLl87cHyAV5mtcBAkWDrwfwBs8ycno' +
	      'FVgtIDx0DuQZBgYiBJUHsw3gOxB4sEwz3QX64KWP4JVAW0+yAY+H0Af6hr0' +
	      'H4JsCfxyUMNz8f9o8YPJzzOCviSMiBQ0pKXYP6W4UBO3NNr7dMrzLsghfdg' +
	      'RLeBvCayuFgyvnHgHSVvtYDuQXlBHvttEqTuruW3s+vAxqtMXgzwQiGwe7v' +
	      '1IMkqY6YFnVdApWVbodVgIrUWLXFe7woqkBWkewQyquHyVXE3PgLxqrLEte' +
	      'jyANTrQjig0nl+ADZUt2/XBb17APJ1NwH7DwhgKzM01Pwst0FFnVdFvVr51' +
	      'sT522BFHeSqN8Jn8ppQMwq7VNjXDg11wstNUL9327Mew4vG3SPg0AzAoakB' +
	      'HCeMIFQyJhGBG0MOPBYJekRETMqd0YvTI3IxxZkQgAOhEUSEx+TW0Ilar/q' +
	      'ITM6vZt04iwkHDs3IJt34xbhtRGAAEcEjvdN6RaCgsaEcQXoEnG78YjQ5AX' +
	      '+n9YjGnx1YwFxUTC56h/1U1qPZq9f9kaIOTGXz/cHvAPwNSpNAHVYEChpHb' +
	      'wrwur+PQw1Mur+Pw/RkSP52qI7Vg+7vbaSowOv+3mBVgdNtvB2qNl4O9f8C' +
	      'DMDGH4cVgIDAXADwGwBuBWDKAIwJgCEOJpPJZDKZTCaTyWQymUwmk8lkMpl' +
	      'M/69+AFlip7zBTAeRAAAAAElFTkSuQmCC');
	  sProp['map'] = tx;
	  mat = new MARenderMarkerMaterial(sProp);
	} else {
	  sProp['text'] = itm.text;
	  let canvas = document.createElement('canvas');
	  let context = canvas.getContext('2d');
	  context.font = this.labelFont.weight + ' ' +
	                 this.labelFont.size + 'px ' + this.labelFont.family;
	  context.lineWidth = 1;
	  context.strokeStyle = 'rgba(255,255,255,255)';
	  context.fillStyle = 'rgba(255,255,255,255)';
	  context.fillText(sProp['text'], 1, this.labelFont.size + 1);
	  let tx = new THREE.Texture(canvas);
	  tx.needsUpdate = true;
	  sProp['map'] = tx;
	  mat = new MARenderLabelMaterial(sProp);
	}
	break;
      default:
	break;
    }
    return(mat);
  }

  /**
   * @class	MARenderer
   * @function	_setupBloom
   * @brief	Sets up or removes bloom rendering.
   * @param	state		Sets up if true, removes if false.
   */
  _setupBloom(state) {
    if(state) {
      this.bloom = new MARenderBloom()
      if(this.scene && this.camera && this.renderer) {
        this.bloom.init(this.scene, this.camera, this.renderer);
      }
    } else {
      /* Currently there is no way to remove the multipass bloom rendering. */
    }
  }

  /**
   * @class	MARenderer
   * @function	_computeCenter
   * @brief	Computes the scene centre and sets the camera trackball to
   * 		view the centre.
   */
  _computeCenter() {
    let n = 0;
    let box = new THREE.Box3();
    for(let i = 0, l = this.scene.children.length; i < l; i ++ ) {
      let child = this.scene.children[i];
      if(child && 
         ((child.type === 'Mesh') ||
	  (child.type === 'Points'))) {
	++n;
	let b = new THREE.Box3();
	b.setFromObject(child);
	b.min.add(child.position);
	b.max.add(child.position);
        if(n == 1) {
	  box.copy(b);
	}
	else {
	  box.union(b);
	}
      }
    }
    if(n > 0) {
      let d, min, max, dMax;
      min = box.min.x;
      max = box.max.x;
      dMax = box.max.x - box.min.x;
      d = box.max.y - box.min.y;
      if(d > dMax)
      {
        dMax = d;
      }
      if(min > box.min.y)
      {
        min = box.min.y;
      }
      if(max < box.max.y)
      {
        max = box.max.y;
      }
      d = box.max.z - box.min.z;
      if(d > dMax)
      {
        dMax = d;
      }
      if(min > box.min.z)
      {
        min = box.min.z;
      }
      if(max < box.max.z)
      {
        max = box.max.z;
      }
      this.center.set((box.min.x + box.max.x) / 2.0,
                      (box.min.y + box.max.y) / 2.0,
		      (box.min.z + box.max.z) / 2.0);
      this.nearPlane = (min < 0.2)? 0.1: min * 0.5;
      this.farPlane =  (max < 1.0)? 10.0: max * 10.0;
      this.cameraPos.set(0, 0, this.center.z + (4.0 * dMax));
    }
  }

  /**
   * @class	MARenderer
   * @function	_testCode
   * @brief	Prints debug output to the console.
   */
  _testCode() {
    console.log('ren.version = ' + this.version);
    console.log('cen = (' +
		this.center.x + ', ' +
		this.center.y + ', ' +
		this.center.z + ')');
    console.log('near = ' + this.nearPlane);
    console.log('far = ' + this.farPlane);
    console.log('pos = ' + 
                 this.camera.position.x + ', ' +
		 this.camera.position.y + ', ' +
		 this.camera.position.z + ')');
    console.log('up = (' + 
		this.camera.up.x + ', ' +
		this.camera.up.y + ', ' +
		this.camera.up.z + ')');
    console.log('ren.setCamera(new THREE.Vector3(' +
		this.center.x + ', ' +
		this.center.y + ', ' +
		this.center.z + '), ' +
		this.nearPlane + ', ' +
		this.farPlane + ', ' +
		'new THREE.Vector3(' +
		this.camera.position.x + ', ' +
		this.camera.position.y + ', ' +
		this.camera.position.z + '));\n' +
                'ren.setHome(new THREE.Vector3(' +
		this.cameraControls.object.position.x + ', ' +
		this.cameraControls.object.position.y + ', ' +
		this.cameraControls.object.position.z + '), ' +
		'new THREE.Vector3(' +
		this.camera.up.x + ', ' +
		this.camera.up.y + ', ' +
		this.camera.up.z + '));');
    console.log('mousePos = (' + this.mousePos.x +
                          ', ' + this.mousePos.y + ')');
  }

  /**
   * @class	MARenderer
   * @function	_pick
   * @brief	Performs picking and then dispatches a pick event.
   * @param 	e		The event.
   */
  _pick(e) {
    let doPick = true;
    if((e.type === 'pointerdown') || (e.type === 'pointerup')) {
      doPick = false;
      if((e.type === 'pointerdown') && (e.buttons === 1)) {
	this.pickTimestamp = e.timeStamp;
      } else if((e.type === 'pointerup') && (e.buttons === 0)) {
	let del = Math.abs(this.pickTimestamp - e.timeStamp);
	if(del <= this.pickMaxPointerDelay) {
	  doPick = true;
	}
      }
    }
    if(doPick) {
      let pos = this.mousePos;
      pos.y = pos.y + this.pickOfs;
      this.raycaster.setFromCamera(pos, this.camera);
      let isct = this.raycaster.intersectObjects(this.scene.children, false);
      if(isct.length > 0) {
	this.eventHandler.dispatchEvent({type: 'pick', hitlist: isct});
      }
    }
  }

  /**
   * @class 	MARenderer
   * @function	_trackMouse
   * @brief	Tracks the mouse position and resets the animation timer.
   * @param 	e		The event.
   */
  _trackMouse(e) {
    this.mousePos.x =  ((e.clientX - this.conOffset.x) /
                        this.con.clientWidth) *  2 - 1;
    this.mousePos.y = -((e.clientY - this.conOffset.y) /
                        this.con.clientHeight) * 2 + 1;
    this.makeLive();
  }

  /**
   * \class	MARenderer
   * @function	_keyPressed
   * @brief	Handles keypress events.
   * @param 	e		The event.
   */
  _keyPressed(e) {
    switch(e.charCode) {
      case 33: // ! Test code
	this._testCode();
        break;
      case 60: // < opacity down
	this.opacityIncrement(-0.1);
	break;
      case 62: // > opacity up
	this.opacityIncrement(0.1);
	break;
      case 63: // ?
	this._pick(e);
        break;
      case 67: // C
        this.setCamera();
	break;
      case 72: // H
	this.setHome();
        break;
      case 104: // h
	this.goHome();
        break;
      case 112: // p
	this.pointSizeIncrement(+0.1);
        break;
      case 113: // q
	this.pointSizeIncrement(-0.1);
        break;
      case 115: // s
	this._updateAllMesh({mode: MARenderMode.PHONG});
        break;
      case 119: // w
	this._updateAllMesh({mode: MARenderMode.WIREFRAME});
        break;
      default:
        break;
    }
    console.log('MARender: charCode = ' + e.charCode);
  }

  /**
   * @class	MARenderer
   * @function	_windowResize
   * @brief	Responds to window resize events.
   */
  _windowResize() {
    this.handleWindowResize();
    this.makeLive();
  }

}

export {
 	MARenderMode,
	MARenderShape,
	MARenderItem,
	MARenderFont,
	MARenderer
};

