# MARender

A JavaScript 3D rendering system based on three.js (http://threejs.org/).

The rendering system is centred around a JavaScript class MARenderer and
aimed at simple web-based visualisation of 3D bio-medical datasets,
with particular emphasis on anatomy and mapped spatial data
(eg gene expression).

Typical uses combine surface, section and point cloud renderings. Surfaces
and point clouds are read from VTK format files using the modified VTK loader.
Sections may be read either from static images or from an IIP3D server
(https://github.com/ma-tech/WlzIIPSrv).

## Examples

A minimal example
<a
href="https://github.com/ma-tech/MARender/blob/master/examples/Minimal.html">
source</a>
and
<a
href="https://github.com/ma-tech/MARender/blob/master/examples/minimal-screenshot.png">
screenshot</a>.

A more complex example 
(<https://github.com/ma-tech/MARender/blob/master/examples/example.html>
examples/example.html</a>) from which screenshot 03 below was taken,
shows arbitrary sectioning of a 3D volumetric image
(through integration with IIP3D),
surfaces and point clouds.

## Screenshots

<a
href="https://github.com/ma-tech/MARender/blob/master/examples/screenshot-01.png">
01</a>

<a
href="https://github.com/ma-tech/MARender/blob/master/examples/screenshot-02.png">
02</a>

<a
href="https://github.com/ma-tech/MARender/blob/master/examples/screenshot-03.png">
03</a>
