/*!
* \file         MARender.js
* \author       Bill Hill
* \date         June 2015
* \version      $Id$
* \par
* Address:
*               MRC Human Genetics Unit,
*               MRC Institute of Genetics and Molecular Medicine,
*               University of Edinburgh,
*               Western General Hospital,
*               Edinburgh, EH4 2XU, UK.
* \par
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
* \brief	A simple renderer based on three.js which is aimed
* 		at displaying anatomy and gene expression domains in 3D.
*/

/**
* Rendering modes
*/
MARenderMode = {
  BASIC:                0,
  WIREFRAME:            1,
  LAMBERT:              2,
  PHONG:                3,
  EMISSIVE:             4,
  POINT:		5,
  SECTION:		6
}

/**
* Properties which may be set when adding or updating a model.
*/
MARenderItem = function() {
  this.name             = undefined;
  this.path             = undefined;
  this.color            = 0x000000;
  this.transparent      = false;
  this.opacity          = 1.0;
  this.mode             = MARenderMode.PHONG;
  this.vertices		= undefined;
  this.texture		= undefined;
  this.visible          = true;
}

/*!
* \class	MARenderer
* \constructor
* \brief 	Creates a new renderer.
* \param win	The window used by the renderer.
* \param con	The container used by the renderer. A new div for the
* 		renderer will be created within this container.
*/
MARenderer = function(win, con) {
  var self = this;
  this.type = 'MARenderer';
  Object.defineProperty(self, 'version', {value: '1.2.1', writable: false});
  this.win = win;
  this.con = con;
  this.scene;
  this.ambLight;
  this.dirLight;
  this.pntLight;
  this.camera;
  this.controls;
  this.renderer;
  this.animCount = 0;    // Used to count animation frames since mouse movement
  this.pointSize = 2;
  this.mousePos = new THREE.Vector2(0,0);
  this.pickOfs = 0;
  this.nearPlane = 1;
  this.farPlane = 10000;
  this.setCamOnLoad = true;
  this.setHomeOnLoad = true;
  this.cameraPos = new THREE.Vector3(0, 0, 10000);
  this.center   = new THREE.Vector3(0, 0, 0);
  this.homeUp   = new THREE.Vector3(0, 0, 1);
  this.homePos  = new THREE.Vector3(0, 0, 0);
  this.eventHandler = new THREE.EventDispatcher();
  THREE.ImageUtils.crossOrigin = ''; // To allow CORS textures

  this.init = function() {

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(25,
				   this.win.innerWidth / this.win.innerHeight,
				   this.nearPlane, this.farPlane);

    this.camera.updateProjectionMatrix();
    this.controls = new THREE.TrackballControls(this.camera);
    this.controls.panSpeed = 0.3;
    this.controls.dynamicDampingFactor = 0.7;

    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setSize(this.win.innerWidth, this.win.innerHeight);
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

    self.win.addEventListener('mousemove', self._trackMouse, false);
    self.win.addEventListener('keypress', self._keyPressed, false);
    self.win.addEventListener('resize', self._windowResize, false);
  }

  /*!
   * \class     MARenderer
   * \function	setPickOfs
   * \brief	Adds an offset to the mouse coords to compensate for title
   *            div above the canvas
   * \param ofs	height of title div in pixels
   */
  this.setPickOfs = function(ofs) {

     var iofs;
     var innerH;

     innerH = self.win.innerHeight;
     //alert("innerH " + innerH);

     if(ofs !== undefined) {
        iofs = parseInt(ofs, 10);
        self.pickOfs = (iofs / self.win.innerHeight) * 2;
     }
     //alert("pickOfs " + self.pickOfs);
  }

  /*!
   * \class     MARenderer
   * \function	addModel
   * \brief	Adds a new model to the renderer using the given properties.
   * \param gProp	Model properties which conform to MARenderItem and
   * 			must include a unique name.
   */
  this.addModel = function(gProp) {
    var loader;
    var itm = this._makeRenderItem(gProp);
    if(itm) {
      switch(Number(itm.mode)) {
	case MARenderMode.BASIC:
	case MARenderMode.WIREFRAME:
	case MARenderMode.LAMBERT:
	case MARenderMode.PHONG:
	case MARenderMode.EMISSIVE:
	case MARenderMode.POINT:
	  if(itm.path) {
	    var ext = itm.path.split('.').pop();
	    if(ext === 'stl') {
	      loader = new THREE.STLLoader();
	    } else if(ext === 'vtk') {
	      loader = new THREE.VTKLoader();
	    } else {
	      console.log('MARenderer.addModel() unknown file type: ' + ext);
	    }
	    loader.load(itm.path,
	      function(geom) {
		var mat = self._makeMaterial(itm);
		if(mat) {
		  switch(Number(itm.mode)) {
		    case MARenderMode.POINT:
		      if(geom.colors.length > 0) {
                        mat.vertexColors = THREE.VertexColors;
		      }
		      var pcld = new THREE.PointCloud(geom, mat);
		      pcld.name = itm.name;
		      pcld.sortParticles = true;
		      self.scene.add(pcld);
		      break;
		    default:
		      var mesh = new THREE.Mesh(geom, mat);
		      mesh.name = itm.name;
		      self.scene.add(mesh);
		      break;
		  }
		  if(self.setCamOnLoad) {
		    self._computeCenter();
		    self.setCamera();
		  }
		  if(self.setHomeOnLoad) {
		    self.setHome();
		  }
		  self.makeLive();
		}
	      },
	      function(){},
	      function() {
		console.log('MARenderer.addModel() geometry load failed: ' +
		            itm.path);
	      });
	  }
	  break;
	case MARenderMode.SECTION:
	  if(itm.texture) {
	    THREE.ImageUtils.loadTexture(itm.texture,
		THREE.UVMapping,
		function(tex) {
		  // onLoad
		  var geom = self.makeSectionGeometry(itm.vertices);
		  var mat = self._makeMaterial(itm);
		  tex.flipY = false;
		  tex.minFilter = THREE.LinearFilter;
		  tex.needsUpdate = true;
		  mat.map = tex;
		  var pln = new THREE.Mesh(geom, mat);
		  pln.name = itm.name;
		  self.scene.add(pln);
		  self.makeLive();
		},
		function() {
	          console.log('MARenderer.addModel() texture load failed: ' +
		              itm.texture);
		});
	  }
	  break;
	default:
	  break;
      }
    }
  }

  /*!
   * \class     MARenderer
   * \function	updateModel
   * \brief	Updates an existing model of the renderer using the given
   * 		properties.
   * \param gProp	Model properties which conform to MARenderItem and
   * 			must include a unique name.
   */
  this.updateModel = function(gProp) {
    if(gProp['name']) {
      var name = gProp['name'];
      var obj = this.scene.getObjectByName(name, true);
      if(obj) {
	this._updateObj(obj, gProp);
      }
    }
    this.render();
  }

  /*!
   * \class	MARenderer
   * \function	makeSectionGeometry
   * \return	New geometry.
   * \brief	Create a geometry for use in rendering planar sections.
   * \param vertices	Array of four ordered 3D vertices at the position
   * 			of the rectangular sections corners.
   */
  this.makeSectionGeometry = function(vertices) {
    var geom = new THREE.Geometry();
    if(vertices) {
      geom.vertices = vertices.slice(0);
    } else {
      geom.vertices = [new THREE.Vector3(0, 0, 0),
		       new THREE.Vector3(1, 0, 0),
		       new THREE.Vector3(1, 1, 0),
		       new THREE.Vector3(0, 1, 0)];
    }
    geom.faces = [new THREE.Face3(0, 1, 2),
		  new THREE.Face3(2, 3, 0)];
    geom.faceVertexUvs[0] = [[new THREE.Vector2(0, 0),
			      new THREE.Vector2(1, 0),
			      new THREE.Vector2(1, 1)],
			    [new THREE.Vector2(1, 1),
			     new THREE.Vector2(0, 1),
			     new THREE.Vector2(0, 0)]];
    geom.computeFaceNormals();
    geom.computeBoundingBox();
    return(geom);
  }

  /*!
   * \class	MARenderer
   * \function	setCamera
   * \brief	Sets the camera for the renderer.
   * \param cen		Centre of the scene.
   * \param near	Camera near plane.
   * \param far		Camera far plane.
   * \param pos		Camera position.
   */
  this.setCamera = function(cen, near, far, pos) {
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

  /*!
   * \class	MARenderer
   * \function	setHome
   * \brief	Sets the camera home position.
   * \param pos		Given camera home position, default is the current
   * 			camera trackball position.
   * \param up		Given camera up vector, default is the current
   * 			camera trackball up vector.
   */
  this.setHome = function(pos, up) {
    if(pos || up) {
      this.setHomeOnLoad = false;
    }
    if(pos === undefined) {
      pos = this.controls.object.position.clone();
    }
    if(up === undefined) {
      up = this.controls.object.up.clone();
    }
    this.homeUp.copy(up);
    this.homePos.copy(pos);
    this.goHome();
  }

  /*!
   * \class	MARenderer
   * \function	goHome
   * \brief	Moves the camera trackball to the current home position.
   */
  this.goHome = function() {
    this.controls.up0.copy(this.homeUp);
    this.controls.position0.copy(this.homePos);
    this.controls.target0.copy(this.center);
    this.controls.reset();
  }

  /*!
   * \class	MARenderer
   * \function	removeModel
   * \brief	Removes the named model and frees its resources.
   * \param name	Given model name.
   */
  this.removeModel = function(name) {
    var obj = this.scene.getObjectByName(name, true);
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

  /*!
   * \class	MARenderer
   * \function	getChildren
   * \brief	Gets the children of the scene.
   */
  this.getChildren = function() {
    return this.scene.children;
  }

  /*!
   * \class	MARenderer
   * \function	opacityIncrement
   * \brief	Increments the opacity of all transparent models.
   * \param inc		Opacity increment which may be positive or
   * 			negative.
   */
  this.opacityIncrement = function(inc) {
    for(var i = 0, l = this.scene.children.length; i < l; i ++ ) {
      var child = this.scene.children[i];
      if(child && (child.type === 'Mesh')) {
        if(child.material && child.material.transparent &&
	   (child.material.opacity != undefined)) {
	  var op = child.material.opacity;
	  var tr = child.material.transparent;
	  if(inc > 0.0) {
	    if(op < 0.01) {
	      op = 1.0 / 64.0;
	      } else {
	        op *= 2.0;
	      }
	  } else {
	    op /= 2.0;
	  }
	  this._setMaterialOpacity(child.material, tr, op);
	  child.material.needsUpdate = true;
          this.render();
	}
      }
    }
  }

  /*!
   * \class	MARenderer
   * \function	pointSizeSet
   * \brief	Sets the current default point size and the point size of
   * 		all point cloud models.
   * \param sz		Given point size. By default the current point size
   * 			is used.
   */
  this.pointSizeSet = function(sz) {
    if(sz === undefined) {
      sz = this.pointSize;
    }
    for(var i = 0, l = this.scene.children.length; i < l; i ++ ) {
      var child = this.scene.children[i];
      if(child && (child.type === 'PointCloud')) {
        if(child.material && child.material.size) {
	  child.material.size = sz;
	  child.material.needsUpdate = true;
          this.render();
	}
      }
    }
    this.pointSize = sz;
  }

  /*!
   * \class	MARenderer
   * \function	pointSizeIncrement
   * \brief	Increments the point size of all point cloud models.
   * \param inc		Increment which may be positive or negative.
   */
  this.pointSizeIncrement = function(inc) {
    for(var i = 0, l = this.scene.children.length; i < l; i ++ ) {
      var child = this.scene.children[i];
      if(child && (child.type === 'PointCloud')) {
        if(child.material && child.material.size) {
	  child.material.size += inc;
	  if(child.material.size > 99.9) {
	    child.material.size = 99.9;
	  }
	  else if(child.material.size < 0.1) {
	    child.material.size = 0.1;
	  }
	  child.material.needsUpdate = true;
          this.render();
	}
      }
    }
  }

  /*!
   * \class	MARenderer
   * \function	render
   * \brief	Renders the scene now.
   */
  this.render = function() {
    this.renderer.render(self.scene, self.camera);
  }

  /*!
   * \class	MARenderer
   * \function	animate
   * \brief	Starts rendering the scene. The rendering will be repeated
   * 		under the control of a timer and following mouse movement
   * 		or scene updates.
   */
  this.animate = function() {
    var aid = self.win.requestAnimationFrame(self.animate);
    self.controls.update();
    self.render();
    if(++(self.animCount) > 400) {
      self.win.cancelAnimationFrame(aid);
    }
  }

  /*!
   * \class	MARenderer
   * \function	makeLive
   * \brief	Makes sure that the scene is rendered and resets the
   * 		rendering timer.
   */
  this.makeLive = function() {
    var count = this.animCount;
    this.animCount = 0;
    if(count > 200) {
      this.animate();
    }
  }

  /*!
   * \class 	MARenderer
   * \function	addEventListener
   * \brief	Adds the event listener.
   * \param type	Event type.
   * \param listener	The event listener function.
   */
  this.addEventListener = function(type, listener) {
    this.eventHandler.addEventListener(type, listener)
  }

  /*!
   * \class 	MARenderer
   * \function	removeEventListener
   * \brief	Removes the event listener.
   * \param type	Event type.
   * \param listener	The event listener function.
   */
  this.removeEventListener = function(type, listener) {
    this.eventHandler.removeEventListener(type, listener)
  }

  /*!
   * \class	MARenderer
   * \function	getIIP3DBBVertices
   * \brief	Get vertices of the section defined by the IIP3D request
   *            encoded in the given URL using voxel scaling.
   * \param url		The IIP3D URL which should define the section but
   *                    not include an OBJ, CVT or tile request.
   * \param vsz		The voxel size, supplied as a THREE.Vector3().
   */
  this.getIIP3DBBVertices = function(url, vsz) {
    var prmX = [0, 1, 1, 0];
    var prmY = [0, 0, 1, 1];
    var max = new THREE.Vector2();
    var vtx = [new THREE.Vector3(), new THREE.Vector3(),
	       new THREE.Vector3(), new THREE.Vector3()];
    var req = new XMLHttpRequest();
    req.open('GET', url + '&OBJ=Wlz-true-voxel-size', false);
    req.send(null);
    req.open('GET', url + '&OBJ=Max-size', false);
    req.send(null);
    if(req.status === 200) {
      // rsp = Max-size:321 173
      var rsp = req.responseText.split(':')[1].split(' ');
      max.x = rsp[0] - 1.0;
      max.y = rsp[1] - 1.0;
    }
    for(var idx = 0; idx < 4; ++idx) {
      req.open('GET', url + '&PRL=-1,' +
	       prmX[idx] * max.x + ',' +
	       prmY[idx] * max.y +
               '&OBJ=Wlz-coordinate-3D', false);
      req.send(null);
      if(req.status === 200) {
	var rsp = req.responseText.split(':')[1].split(' ');
	vtx[idx].set(rsp[0] * vsz.x, rsp[1] * vsz.y, rsp[2] * vsz.z);
      }
    }
    return(vtx);
  }

  /*!
   * \class	MARenderer
   * \function	_setMaterialOpacity
   * \brief	Sets the opacity of the given material.
   * \param mat		Given material.
   * \param tr		True if material is tranparent, if false function
   * 			simply returns.
   * \param op		Given opacity.
   */
  this._setMaterialOpacity = function(mat, tr, op) {
    if(mat && tr) {
      if(op < 0.01) {
	mat['opacity'] = 0.0;
	mat['visible'] = false;
      } else {
	if(op > 1.0) {
	  op = 1.0;
	}
	if(op < 0.51) {
	  mat['depthWrite'] = false;
	} else {
	  mat['depthWrite'] = true;
	}
	mat['opacity'] = op;
	mat['visible'] = true;
      }
      this.render();
    }
  }

  /*!
   * \class 	MARenderer
   * \function	_updateObj
   * \brief	Updates the given objects properties.
   * \param obj		Given object.
   * \param		Properties to set in the given object.
   */
  this._updateObj = function(obj, gProp) {
    var itm = new MARenderItem();
    if(itm) {
      itm.name = name;
      if(gProp['color']) {
	itm.color = gProp['color'];
      } else if(obj.material && obj.material.color) {
	itm.color = obj.material.color;
      }
      if(gProp['opacity']) {
	itm.opacity = gProp['opacity'];
      } else if(obj.material && obj.material.opacity) {
	itm.opacity = obj.material.opacity;
      }
      if(gProp['transparent']) {
	itm.transparent = gProp['transparent'];
      } else if(obj.material && obj.material.transparent) {
	itm.transparent = obj.material.transparent;
      }
      if(gProp['visible'] !== 'undefined') {
	itm.visible = gProp['visible'];
	obj.visible = itm.visible;
      }
      if(gProp['texture']) {
	itm.texture = gProp['texture'].slice(0);
      }
      if(gProp['vertices']) {
	itm.vertices = gProp['vertices'].slice(0);
      }
      if(gProp['mode']) {
	// Always set the mode/material type
	var mode = this._checkRenderMode(gProp['mode']);
	if(mode) {
	  itm.mode = mode;
	}
      } else {
        if(obj.type === 'PointCloud') {
	  itm.mode = MARenderMode.POINT;
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
        var mat = this._makeMaterial(itm);
	var oldmat = obj.material;
	obj.material = mat;
	if(oldmat) {
	  oldmat.dispose();
	}
	break;
      case MARenderMode.SECTION:
	{
	  if(itm.texture) {
	    THREE.ImageUtils.loadTexture(itm.texture,
		THREE.UVMapping,
		function(tex) {
		  // onLoad
		  var oldgeom = obj.geometry;
		  var oldtex = obj.material.map;
		  var geom = self.makeSectionGeometry(itm.vertices);
		  tex.flipY = false;
		  tex.minFilter = THREE.LinearFilter;
		  tex.needsUpdate = true;
		  obj.material.map = tex;
		  obj.geometry = geom;
		  oldtex.dispose();
		  oldgeom.dispose();
		  self.makeLive();
		},
		function() {
	          console.log('MARenderer.updateObj() texture load failed: ' +
		              itm.texture);
		});
	  }
	}
	break;
    }
  }

  /*!
   * \class	MARenderer
   * \function	_updateAllMesh
   * \brief	Updates the properties of all meshes.
   * \param gProp	Given properties to update.
   */
  this._updateAllMesh = function(gProp) {
    for(var i = 0, l = this.scene.children.length; i < l; i ++ ) {
      var child = this.scene.children[i];
      if(child && (child.type === 'Mesh')) {
        if(child.material && !(child.material.map)) {
	  this._updateObj(child, gProp);
          this.render();
        }
      }
    }
  }

  /*!
   * \class	MARenderer
   * \function	_makeRenderItem
   * \return	New render item.
   * \brief	Create a new render item the given properties set.
   * 		All properties not given have the default value.
   * \param gProp	Given properties.
   */
  this._makeRenderItem = function(gProp) {
    var ok = true;
    var itm = new MARenderItem();
    for(var p in gProp) {
      switch(p) {
        case 'name':
        case 'path':
          itm[p] = gProp[p];
          break;
        case 'color':
        case 'opacity':
	  itm[p] = Number(gProp[p]);
          break;
        case 'transparent':
          itm[p] = Boolean(gProp[p]);
          break;
        case 'mode':
	  var mode = this._checkRenderMode(gProp[p]);
	  if(mode) {
	    itm[p] = mode;
	  }
	  break;
	case 'vertices':
	  itm[p] = gProp[p].slice(0);
	  break;
	case 'texture':
	  itm[p] = gProp[p].slice(0);
	  break;
	case 'visible':
	  itm[p] = Boolean(gProp[p]);
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

  /*!
   * \class	MARenderer
   * \function	_checkRenderMode
   * \return	Given render mode or undefined if the render mode is invalid.
   * \brief	Checks that the given render mode is valid.
   * \param gMode	Given render mode.
   */
  this._checkRenderMode = function(gMode) {
    var rMode = undefined;
    if(gMode) {
      switch(Number(gMode)) {
	case MARenderMode.BASIC:
	case MARenderMode.WIREFRAME:
	case MARenderMode.LAMBERT:
	case MARenderMode.PHONG:
	case MARenderMode.EMISSIVE:
	case MARenderMode.POINT:
	case MARenderMode.SECTION:
	  rMode = gMode;
	  break;
	default:
	  console.log('MARenderer: Unknown mode: ' + gMode);
	  break;
      }
    }
    return(rMode)
  }

  /*!
   * \class	MARenderer
   * \function	_makeMaterial
   * \return	New material.
   * \brief	Makes a new material using the properties of the given render
   * 		item.
   * \param itm		Given render item.
   */
  this._makeMaterial = function(itm) {
    var mat;
    var sProp = {};
    switch(itm.mode) {
      case MARenderMode.BASIC:
	sProp['color'] = itm.color;
	sProp['wiretrame'] = false;
	mat = new THREE.MeshBasicMaterial(sProp);
	break;
      case MARenderMode.WIREFRAME:
	sProp['color'] = itm.color;
	sProp['wireframe'] = true;
	sProp['wireframeLinewidth'] = 1;
	sProp['opacity'] = itm.opacity;
	sProp['transparent'] = itm.transparent;
	mat = new THREE.MeshLambertMaterial(sProp);
	break;
      case MARenderMode.LAMBERT:
	sProp['color'] = itm.color;
	sProp['wireframe'] = false;
	/* Use single sided, surfaces may need normals flipping
	 * sProp['side'] = THREE.DoubleSide; */
	sProp['opacity'] = itm.opacity;
	sProp['transparent'] = itm.transparent;
	mat = new THREE.MeshLambertMaterial(sProp);
	break;
      case MARenderMode.PHONG:
	sProp['color'] = itm.color;
	sProp['specular'] = 0x111111;
	sProp['wireframe'] = false;
	/* Use single sided, surfaces may need normals flipping
	 * sProp['side'] = THREE.DoubleSide; */
	sProp['emissive'] = 0x000000;
	sProp['shininess'] = 25;
	sProp['transparent'] = itm.transparent;
	this._setMaterialOpacity(sProp, itm.transparent, itm.opacity);
	mat = new THREE.MeshPhongMaterial(sProp);
	break;
      case MARenderMode.EMISSIVE:
	sProp['color'] = itm.color;
	sProp['specular'] =0x777777;
	sProp['wireframe'] = false;
	sProp['opacity'] = itm.opacity;
	sProp['emissive'] = itm.color;
	sProp['transparent'] = itm.transparent;
	sProp['shininess'] = 15;
	mat = new THREE.MeshPhongMaterial(sProp);
	break;
      case MARenderMode.POINT:
	sProp['color'] = itm.color;
	sProp['opacity'] = itm.opacity;
	sProp['transparent'] = itm.transparent;
	sProp['size'] = this.pointSize;
	sProp['blending'] = THREE.AdditiveBlending;
	sProp['alphaTest'] = 0.5;
	sProp['map'] = THREE.ImageUtils.loadTexture('textures/particle8.png');
	mat = new THREE.PointCloudMaterial(sProp);
	break;
      case MARenderMode.SECTION:
	sProp['color'] = itm.color;
	sProp['wireframe'] = false;
	sProp['side'] = THREE.DoubleSide;
	sProp['opacity'] = itm.opacity;
	mat = new THREE.MeshBasicMaterial(sProp);
	break;
    }
    return(mat);
  }

  /*!
   * \class	MARenderer
   * \function	_computeCenter
   * \brief	Computes the scene centre and sets the camera trackball to
   * 		view the centre.
   */
  this._computeCenter = function() {
    var n = 0;
    var box = new THREE.Box3();
    for(var i = 0, l = this.scene.children.length; i < l; i ++ ) {
      var child = this.scene.children[i];
      if(child && 
         ((child.type === 'Mesh') ||
	  (child.type === 'PointCloud'))) {
	++n;
	var b = new THREE.Box3();
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
      var d, min, max, dMax;
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
      this.center.copy(box.center());
      this.nearPlane = (min < 0.2)? 0.1: min * 0.5;
      this.farPlane =  (max < 1.0)? 10.0: max * 10.0;
      this.cameraPos.set(0, 0, this.center.z + (4.0 * dMax));
    }
  }

  /*!
   * \class	MARenderer
   * \function	_testCode
   * \brief	Prints debug output to the console.
   */
  this._testCode	= function() {
    console.log('ren.version = ' + self.version);
    console.log('ren.setCamera(new THREE.Vector3(' +
		self.center.x + ', ' +
		self.center.y + ', ' +
		self.center.z + '), ' +
		self.nearPlane + ', ' +
		self.farPlane + ', ' +
		'new THREE.Vector3(' +
		self.camera.position.x + ', ' +
		self.camera.position.y + ', ' +
		self.camera.position.z + '));\n' +
                'ren.setHome(new THREE.Vector3(' +
		self.controls.object.position.x + ', ' +
		self.controls.object.position.y + ', ' +
		self.controls.object.position.z + '), ' +
		'new THREE.Vector3(' +
		self.camera.up.x + ', ' +
		self.camera.up.y + ', ' +
		self.camera.up.z + '));');
  }

  /*!
   * \class	MARenderer
   * \function	_pick
   * \brief	Performs picking and then dispatches a pick event.
   */
  this._pick = function() {
    var pos = this.mousePos;
    pos.y = pos.y + self.pickOfs;
    self.raycaster.setFromCamera(pos, self.camera);
    var isct = self.raycaster.intersectObjects(self.scene.children, false);
    if(isct.length > 0) {
      self.eventHandler.dispatchEvent({type: 'pick',
                                       hitlist: isct});
    }
  }

  /*!
   * \class 	MARenderer
   * \function	_trackMouse
   * \brief	Tracks the mouse position and resets the animation timer.
   * \param e		The event.
   */
  this._trackMouse = function(e) {
    self.mousePos.x =  (e.clientX / self.win.innerWidth) *  2 - 1;
    self.mousePos.y = -(e.clientY / self.win.innerHeight) * 2 + 1;
    self.makeLive();
  }

  /*! \class	MARenderer
   * \function	_keyPressed
   * \brief	Handles keypress events.
   * \param e		The event.
   */
  this._keyPressed = function(e) {
    switch(e.charCode) {
      case 33: // ! Test code
	self._testCode();
        break;
      case 60: // < opacity down
	self.opacityIncrement(-1);
	break;
      case 62: // > opacity up
	self.opacityIncrement(1);
	break;
      case 63: // ?
	self._pick();
        break;
      case 67: // C
        self.setCamera();
	self.goHome();
	break;
      case 72: // H
	self.setHome();
        break;
      case 104: // h
	self.goHome();
        break;
      case 112: // p
	self.pointSizeIncrement(+0.1);
        break;
      case 113: // q
	self.pointSizeIncrement(-0.1);
        break;
      case 115: // s
	self._updateAllMesh({mode: MARenderMode.PHONG});
        break;
      case 119: // w
	self._updateAllMesh({mode: MARenderMode.WIREFRAME});
        break;
      default:
        break;
    }
    console.log('MARender: charCode = ' + e.charCode);
  }

  /*!
   * \class	MARenderer
   * \function	_windowResize
   * \brief	Handles window resize events.
   */
  this._windowResize = function() {
    self.camera.aspect = self.win.innerWidth / self.win.innerHeight;
    self.camera.updateProjectionMatrix();
    self.renderer.setSize(self.win.innerWidth, self.win.innerHeight);
    self.controls.handleResize();
    self.makeLive();
  }

}
