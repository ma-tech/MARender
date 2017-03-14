/*!*
* \file         MAVTKLoader.js
* \author       mrdoob, Bill Hill
* \date         June 2015
* \version      $Id$
* \brief	A VTK file loader for three.js. This is based on the VTK
* 		loader by mrdoob. Differences (so far) from the original
* 		are:
* 		* slightly more flexible parsing
* 		* polygons are optional and polygons other than triangles
* 		  are not supported
* 		* able to set color of materials attached to geometry
* 		* bounding box and sphere set
*/

THREE.VTKLoader = function(manager) {
	this.manager = (manager !== undefined)?
	               manager: THREE.DefaultLoadingManager;
};

THREE.VTKLoader.prototype = {
constructor: THREE.VTKLoader,

	     load: function(url, onLoad, onProgress, onError) {
		     var scope = this;
		     var loader = new THREE.XHRLoader(scope.manager);
		     loader.setCrossOrigin(this.crossOrigin);
		     var req = loader.load(url,
		                     function (text) {
				     onLoad(scope.parse(text));
				     }, onProgress, onError);
		     return(req);
	     },

parse: function(data) {
	       var idx, pattern, reg_index, result;
	       var line = 0, n_points = 0, n_polys = 0; n_dpp = 0;
	       var colors;
	       var geometry = new THREE.Geometry();
	       /*
		* expects to find a legacy format vtk file, such as:
		* # vtk DataFile Version 1.0
		* Some comment text
		* ASCII
		* DATASET POLYDATA
		* POINTS 4 float
		* 0 0 0
		* 100 0 0
		* 50 87 0
		* 50 43 87
		* POLYGONS 4 16
		* 3 0 1 2
		* 3 0 1 3
		* 3 1 2 3
		* 3 2 0 3
		*/
	       // # vtk DataFile Version <uint>.<uint>
	       pattern = /#[\s]+vtk[\s]+DataFile[\s]+Version[\s]+\d+\.\d+/gi;
	       result = pattern.exec(data);
	       if(result) {
		       // Some comment text
		       ++line;
		       // ASCII
		       ++line;
	               reg_index = pattern.lastIndex;
		       pattern = /ASCII/g;
		       pattern.lastIndex = reg_index;
		       result = pattern.exec(data);
	       }
	       if(result) {
		       // DATASET POLYDATA
		       ++line;
	               reg_index = pattern.lastIndex;
		       pattern = /DATASET[\s]+POLYDATA/g;
		       pattern.lastIndex = reg_index;
		       result = pattern.exec(data);
	       }
	       if(result) {
		       // POINTS 4 float
		       ++line;
		       pattern = /POINTS[\s]+([1-9]+[\d]*)[\s]+float/g;
		       pattern.lastIndex = reg_index;
		       if((result = pattern.exec(data)) !== null) {
			       n_points = parseInt(result[1]);
		       }
	       }
	       if(n_points > 0) {
		       // <float> <float> <float>
		       reg_index = pattern.lastIndex;
		       pattern = /(([+-]?[\d]+[.]?[\d\+\-eE]*)[\s]+([+-]?[\d]+[.]?[\d\+\-eE]*)[\s]+([+-]?[\d]+[.]?[\d\+\-eE]*))/g;
		       pattern.lastIndex = reg_index;
		       for(idx = 0; idx < n_points; ++idx) {
			       ++line;
			       result = pattern.exec(data);
			       if(!result) {
				       break;
			       }
			       geometry.vertices.push(
					       new THREE.Vector3(parseFloat(result[2]),
						       parseFloat(result[3]),
						       parseFloat(result[4])));
		       }
	       }
	       if((n_points > 0) && result) {
		       // POLYGONS <uint> <uint> or LINES <uint> <uint>
		       ++line;
		       pattern = /(POLYGONS)[\s]+([1-9]+[\d]*)[\s]+([1-9]+[\d]*)/g;
		       if((result = pattern.exec(data)) !== null) {
			       if(result[1] === 'POLYGONS') {
				       n_polys = parseInt(result[2]);
				       var n_poly_points = parseInt(result[3]);
				       n_dpp = n_poly_points / n_polys;
			       } else {
				 result = null;
			       }

		       } else {
			       result = true; // Allow just points, no polygons or lines
		       }
	       }
	       if((n_points > 0) && result) {
		       if(n_polys > 0) {
			       if(n_dpp === 4) {
				       // 3 <uint> <uint> <uint>
			               var reg_index = pattern.lastIndex;
				       pattern = /3[\s]+([\d]+)[\s]+([\d]+)[\s]+([\d]+)/g;
			               pattern.lastIndex = reg_index;
				       for(idx = 0; idx < n_polys; ++idx) {
					       ++line;
					       if((result = pattern.exec(data)) === null) {
						       break;
					       }
					       geometry.faces.push(
							       new THREE.Face3(parseInt(result[1]),
								       parseInt(result[2]),
								       parseInt(result[3])));
				       }
			       } else if(n_dpp === 5) {
				       // 4 <uint> <uint> <uint> <uint>
				       var reg_index = pattern.lastIndex;
				       pattern = /4[\s]+([\d]+)[\s]+([\d]+)[\s]+([\d]+)[\s]+([\d]+)/g;
				       pattern.lastIndex = reg_index;
				       for(idx = 0; idx < n_polys; ++idx) {
					       ++line;
					       if((result = pattern.exec(data)) === null) {
						       break;
					       }
					       geometry.faces.push(
							       new THREE.Face3(parseInt(result[1]),
								       parseInt(result[2]),
								       parseInt(result[4])));
					       geometry.faces.push(
							       new THREE.Face3(parseInt(result[2]),
								       parseInt(result[3]),
								       parseInt(result[4])));
				       }
			       }
		       }
	       }
	       if(result === null) {
		       geometry = null;
	       } else {
		       if(n_polys > 0) {
			       geometry.computeFaceNormals();
		       }
		       geometry.computeBoundingBox();
		       geometry.computeBoundingSphere();
	       }
	       return geometry;
       }
}
