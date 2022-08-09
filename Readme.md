# MARender

A simple JavaScript 3D rendering system based on
<a href="http://threejs.org/"> three.js </a>.

The rendering system is centred around a JavaScript class MARenderer and
aimed at simple web-based visualisation of 3D bio-medical datasets,
with particular emphasis on anatomy and mapped spatial data
(eg gene expression).

Typical uses combine surfaces, sections, paths and point clouds.
Surfaces and point clouds are read from VTK format files using the modified
VTK loader.
Sections may be read either from static images or from an
<a
href="https://github.com/ma-tech/WlzIIPSrv">
IIP3D</a>
server
Paths are simple lines in 3D and are read from JSON files which specify
points along a path.
Labels and markers may also be added.

## Examples

Using MARender directly:
<a
href="https://github.com/ma-tech/MARender/blob/master/examples/example.html">
source</a>,
<a
href="https://ma-tech.github.io/MARender/examples/example.html">
live</a>,
and
<a
href="https://github.com/ma-tech/MARender/blob/master/examples/screenshot-example.png">
screenshot</a>.

Using MARenderView with a JSON configuration file
writen by
<a
href="https://github.com/ma-tech/MAVTKApps/tree/master/MAVTKSurfViewer">
MAVTKSurfViewer</a>:
<a
href="https://github.com/ma-tech/MARender/blob/master/examples/example.json">
source</a>,
<a
href="https://ma-tech.github.io/MARender/examples/MARenderView.html?config=example.json">
live</a>,
and
<a
href="https://github.com/ma-tech/MARender/blob/master/examples/screenshot-MARenderView.png">
screenshot</a>.

## Requirements

MARenderer is based on three.js and requires the following modules (from
the three.js examples):
BasicShader.js,
CopyShader.js,
Detector.js,
EffectComposer.js,
LineGeometry.js,
LineMaterial.js,
LineSegments2.js,
LineSegmentsGeometry.js,
LuminosityHighPassShader.js,
MaskPass.js,
Pass.js,
RenderPass.js,
ShaderPass.js,
STLLoader.js,
TrackballControls.js,
UnrealBloomPass.js
and a modified VTKLoader module (from the MARender repository):
MAVTKLoader.js

## Acknowledgements and References

MARender was initially developed for use by the
<a
href="https://en.wikipedia.org/wiki/EMAGE">
e-Mouse Atlas Project</a>
within the UK Medical Research Council Human Genetics Unit.

MARender has also been used in a
<a
href="https://doi.org/10.1016/j.ydbio.2019.07.003">
3D molecular atlas of the chick embryonic heart </a>.

Current development is mainly driven by the
<a
href="https://www.ed.ac.uk/comparative-pathology/the-gut-cell-atlas-project">
Gut Cell Atlas Project</a>
funded by the
<a
href="https://helmsleytrust.org/">
Helmsley Charitable Trust</a>.

