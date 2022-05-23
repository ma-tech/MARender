# MARender

A simple JavaScript 3D rendering system based on three.js (http://threejs.org/).

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

