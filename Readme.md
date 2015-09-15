# MARender

A JavaScript 3D rendering system based on three.js (http://threejs.org/).

The rendering system is centred around a JavaScript class MARenderer and
aimed at simple web-based visualisation of 3D bio-medical datasets,
with particular emphasis on anatomy and mapped spatial data
(eg gene expression).

Typical uses combine surface, section and point cloud renderings. Surfaces
and point clouds are most readily read from VTK format files using the
modified VTK loader
https://github.com/ma-tech/three.js/blob/master/examples/js/loaders/VTKLoader.js
and sections either from static images or from an IIP3D server
(https://github.com/ma-tech/WlzIIPSrv).

## Minimal Example
```
<!DOCTYPE html>
<html lang="en">
<head>
<title>Minimal MARender Test</title>
<meta charset="utf-8">
</head>
<style>
body  {background-color: #000; color: #fff;}
#info {background-color: #000; color: #fff; text-align: center;}
</style>

<body>
<div id="info">
Minimal MARender Test
</div>

<script src="js/three.min.js"></script>
<script src="js/TrackballControls.js"></script>
<script src="js/STLLoader.js"></script>
<script src="js/VTKLoader.js"></script>
<script src="js/Detector.js"></script>
<script src="js/MARender.min.js"></script>

<script>

if(!(Detector.webgl)) {
  Detector.addGetWebGLMessage();
}

var container;
container = document.createElement('div');
document.body.appendChild(container);

var ren = new MARenderer(window, container);
ren.init();
ren.addModel({name:        'emb',
              path:        'models/emb.vtk',
	      color:       0xf0f0a0,
	      transparent: true,
	      opacity:	   0.5});
ren.addModel({name:        'neu',
              path:        'models/neu.vtk',
	      color:       0xf0a010,
	      mode:        MARenderMode.POINT});
ren.addModel({name:        'sec',
              texture:     'models/section.png',
	      vertices:	   [new THREE.Vector3( 50, 43,150),
	                    new THREE.Vector3(396, 43,150),
			    new THREE.Vector3(396,230,150),
			    new THREE.Vector3( 50,230,150)],
	      color:       0xffffff,
	      mode:        MARenderMode.SECTION});
ren.animate();
</script>
</body>
</html>
```
<a
href="https://github.com/ma-tech/MARender/blob/master/example/Minimal.html">source</a>
<a
href="https://github.com/ma-tech/MARender/blob/master/example/Minimal.png">screenshot</a>


