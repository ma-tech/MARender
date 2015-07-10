/**
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

MARenderMode = {
  BASIC:                0,
  WIREFRAME:            1,
  LAMBERT:              2,
  PHONG:                3,
  EMISSIVE:             4,
  POINT:		5
}

MARenderItem = function() {
  this.name             = '';
  this.path             = '';
  this.color            = 0x000000;
  this.transparent      = false;
  this.opacity          = 1.0;
  this.mode             = MARenderMode.PHONG;
}

MARenderPickEvent = function() {
}

MARenderer = function(win, con) {
  var self = this;
  this.type = 'MARenderer';
  this.loadCount = 0;
  this.win = win;
  this.con = con;
  this.scene;
  this.ambLight;
  this.dirLight;
  this.pntLight;
  this.camera;
  this.controls;
  this.renderer;
  this.pointSize = 2;
  this.mousePos = new THREE.Vector2();
  this.eventHandler = new THREE.EventDispatcher();

  this.init = function() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(25,
				   this.win.innerWidth / this.win.innerHeight,
				   0.1, 10000);
    this.camera.position.z = 1000;

    this.controls = new THREE.TrackballControls(this.camera);

    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setSize(this.win.innerWidth, this.win.innerHeight);
    this.con.appendChild(this.renderer.domElement);

    this.scene.add(this.camera);
    
    this.ambLight = new THREE.AmbientLight(0x777777);
    this.dirLight = new THREE.DirectionalLight(0x777777);
    this.dirLight.position.set(0, 0, 1);
    this.pntLight = new THREE.PointLight(0x333333, 1, 100 );
    this.pntLight.position.set(0, 0.5, 0);
    this.scene.add(this.pntLight);
    this.camera.add(this.ambLight);
    this.camera.add(this.dirLight);

    this.raycaster = new THREE.Raycaster();
    
    self.win.addEventListener('mousemove', self.trackMouse, false);
    self.win.addEventListener('keypress', self.keyPressed, false);
    self.win.addEventListener('resize', self.windowResize, false);
  }

  this.addModel = function(gProp) {
    var loader;
    var itm = this.makeRenderItem(gProp);
    if(itm) {
      var ext = itm.path.split('.').pop();
      if(ext === 'stl') {
        loader = new THREE.STLLoader();
      } else if(ext === 'vtk') {
        loader = new THREE.VTKLoader();
      } else {
	console.log('MARenderer.addModel() unknown file type: ' + ext);
      }
      ++(self.loadCount);
      loader.load(itm.path,
        function(geom) {
	  var mat = self.makeMaterial(itm);
	  if(mat) {
	    if(gProp['mode'] &&
	       (Number(gProp['mode']) == MARenderMode.POINT)) {
	      var pcld = new THREE.PointCloud(geom, mat);
	      pcld.name = itm.name;
	      pcld.sortParticles = true;
	      self.scene.add(pcld);
	    }
	    else {
	      var mesh = new THREE.Mesh(geom, mat);
	      mesh.name = itm.name;
	      self.scene.add(mesh);
	    }
	  }
          --(self.loadCount);
	  if(self.loadCount < 2) {
	    self.home();
	  }
	});
    }
  }

  this.updateObj = function(obj, gProp) {
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
      if(gProp['mode']) {
	// Always set the mode/material type
	var mode = this.checkMode(gProp['mode']);
	if(mode) {
	  itm.mode = mode;
	}
      } else {
        if(obj.type === 'PointCloud') {
	  itm.mode = MARenderMode.POINT;
	}
      }
    }
    var mat = this.makeMaterial(itm);
    obj.material = mat;
  }

  this.updateModel = function(gProp) {
    if(gProp['name']) {
      name = gProp['name'];
      var obj = this.scene.getObjectByName(name, true);
      if(obj) {
	this.updateObj(obj, gProp);
      }
    }
  }

  this.removeModel = function(name) {
    var obj = this.scene.getObjectByName(name, true);
    if(obj) {
      this.scene.remove(obj);
    }
  }


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
	  child.visible = true;
	  this.setMaterialOpacity(child.material, tr, op);
	  child.material.needsUpdate = true;
	}
      }
    }
  }

  this.setMaterialOpacity = function(mat, tr, op) {
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
    }
  }

  this.pointSizeIncrement = function(inc) {
    for(var i = 0, l = this.scene.children.length; i < l; i ++ ) {
      var child = this.scene.children[i];
      if(child && (child.type === 'PointCloud')) {
        if(child.material && child.material.size) {
	  child.material.size += inc;
	  if(child.material.size > 9.9) {
	    child.material.size = 9.9;
	  }
	  else if(child.material.size < 0.1) {
	    child.material.size = 0.1;
	  }
	  child.material.needsUpdate = true;
	}
      }
    }
  }

  this.updateAllMesh = function(gProp) {
    for(var i = 0, l = this.scene.children.length; i < l; i ++ ) {
      var child = this.scene.children[i];
      if(child && (child.type === 'Mesh')) {
        if(child.material) {
	  this.updateObj(child, gProp);
        }
      }
    }
  }

  this.updateAllPoint = function(gProp) {
    for(var i = 0, l = this.scene.children.length; i < l; i ++ ) {
      var child = this.scene.children[i];
      if(child && (child.type === 'PointCloud')) {
        if(child.material) {
	  this.updateObj(child, gProp);
        }
      }
    }
  }

  this.makeRenderItem = function(gProp) {
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
	  var mode = this.checkMode(gProp[p]);
	  if(mode) {
	    itm[p] = mode;
	  }
	  break;
        default:
	  ok = false;
	  console.log('MARenderer.makeRenderItem() unknown property: ' + p);
	  break;
      }
    }
    if(!ok) {
      itm = undefined;
    }
    return(itm);
  }

  this.checkMode = function(gMode) {
    var rMode = undefined;
    if(gMode) {
      switch(Number(gMode)) {
	case MARenderMode.BASIC:
	case MARenderMode.WIREFRAME:
	case MARenderMode.LAMBERT:
	case MARenderMode.PHONG:
	case MARenderMode.EMISSIVE:
	case MARenderMode.POINT:
	  rMode = gMode;
	  break;
	default:
	  console.log('MARenderer: Unknown mode: ' + gMode);
	  break;
      }
    }
    return(rMode)
  }

  this.makeMaterial = function(itm) {
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
	sProp['side'] = THREE.DoubleSide;
	sProp['opacity'] = itm.opacity;
	sProp['transparent'] = itm.transparent;
	mat = new THREE.MeshLambertMaterial(sProp);
	break;
      case MARenderMode.PHONG:
	sProp['color'] = itm.color;
	sProp['specular'] = 0x111111;
	sProp['wireframe'] = false;
	sProp['side'] = THREE.DoubleSide;
	sProp['emissive'] = 0x000000;
	sProp['shininess'] = 25;
	sProp['transparent'] = itm.transparent;
	this.setMaterialOpacity(sProp, itm.transparent, itm.opacity);
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
	sProp['wireframe'] = false;
	sProp['opacity'] = itm.opacity;
	sProp['transparent'] = itm.transparent;
	sProp['size'] = this.pointSize;
	sProp['blending'] = THREE.AdditiveBlending;
	sProp['alphaTest'] = 0.50;
	sProp['map'] = THREE.ImageUtils.loadTexture('textures/particle8.png');
	mat = new THREE.PointCloudMaterial(sProp)
	break;
    }
    return(mat);
  }

  this.home = function() {
    var n = 0;
    var box = new THREE.Box3();
    for(var i = 0, l = this.scene.children.length; i < l; i ++ ) {
      var child = this.scene.children[i];
      if(child && 
         ((child.type === 'Mesh') || (child.type === 'PointCloud'))) {
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
      var d, max;
      var cen = box.center();
      max = b.max.x - b.min.x;
      d = b.max.y - b.min.y;
      if(d > max)
      {
        max = d;
      }
      d = b.max.z - b.min.z;
      if(d > max)
      {
        max = d;
      }
      var up = new THREE.Vector3(0, 1, 0);
      this.camera.up.copy(up);
      this.camera.position.set(0, 0, cen.z + (10 * max));
      this.controls.up0.copy(up);
      this.controls.target0.copy(cen);
      this.controls.reset();
    }
  }

  this.testCode	= function() {
  }

  this.animate = function() {
    self.win.requestAnimationFrame(self.animate);
    self.controls.update();
    self.renderer.render(self.scene, self.camera);
  }


  this.addEventListener = function(type, listener) {
    this.eventHandler.addEventListener(type, listener)
  }

  this.removeEventListener = function(type, listener) {
    this.eventHandler.removeEventListener(type, listener)
  }

  this.pick = function() {
    var pos = this.mousePos;
    self.raycaster.setFromCamera(pos, self.camera);
    var isct = self.raycaster.intersectObjects(self.scene.children, false);
    if(isct.length > 0) {
      self.eventHandler.dispatchEvent({type: 'pick',
                                       hitlist: isct});
    }
  }

  this.mousePosAtEvent = function(e) {
  var pos = (e.pageX)?
            {'x':e.pageX, 'y':e.pageY}:
	    {'x':e.clientX + this.con.scrollLeft + this.win.scrollLeft,
	     'y':e.clientY + this.con.scrollTop +  this.win.scrollTop}; 
    return(pos);
  };

  this.trackMouse = function(e) {
    self.mousePos.x =  (e.clientX / self.win.innerWidth) *  2 - 1;
    self.mousePos.y = -(e.clientY / self.win.innerHeight) * 2 + 1;
  }

  this.keyPressed = function(e) {
    switch(e.charCode) {
      case 33: // ! Test code
	self.testCode();
        break;
      case 60: // < opacity down
	self.opacityIncrement(-1);
	break;
      case 62: // > opacity up
	self.opacityIncrement(1);
	break;
      case 63: // ?
	self.pick();
        break;
      case 104: // h
        self.home();
	break;
      case 112: // p
	self.pointSizeIncrement(+0.1);
        break;
      case 113: // q
	self.pointSizeIncrement(-0.1);
        break;
      case 115: // s
	self.updateAllMesh({mode: MARenderMode.PHONG});
        break;
      case 119: // w
	self.updateAllMesh({mode: MARenderMode.WIREFRAME});
        break;
      default:
        break;
    }
    // console.log('HACK e.charCode = ' + e.charCode);
  }

  this.windowResize = function() {
    self.camera.aspect = self.win.innerWidth / self.win.innerHeight;
    self.camera.updateProjectionMatrix();
    self.renderer.setSize(self.win.innerWidth, self.win.innerHeight);
    self.controls.handleResize();
  }

}
