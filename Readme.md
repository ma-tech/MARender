# MARender

A JavaScript 3D rendering system based on three.js (http://threejs.org/).

The rendering system is centred around a JavaScript class MARenderer and
aimed at simple web-based visualisation of 3D bio-medical datasets,
with particular emphasis on anatomy and mapped spatial data
(eg gene expression).

Typical uses combine surface, section and point cloud renderings. Surfaces
and point clouds are most readily read from VTK format files using the
modified VTK loader
https://github.com/ma-tech/three.js/blob/master/examples/js/loaders/MAVTKLoader.js
and sections either from static images or from an IIP3D server
(https://github.com/ma-tech/WlzIIPSrv).

## Examples

A Minimal Example
<a
href="https://github.com/ma-tech/MARender/blob/master/example/Minimal.html">
source</a>
and
<a
href="https://github.com/ma-tech/MARender/blob/master/example/minimal-screenshot.png">
screenshot</a>.

A
<a
href="http://aberlour.hgu.mrc.ac.uk/MARenderTests/visabilitytest.html">
more complex example</a>
showing IIP3D integration, surfaces, point clouds and arbitrary sectioning.

## Screenshots

More screenshots: 
<a
href="https://github.com/ma-tech/MARender/blob/master/example/screenshot-01.png">
01</a>
 and 
<a
href="https://github.com/ma-tech/MARender/blob/master/example/screenshot-02.png">
02</a>
.
