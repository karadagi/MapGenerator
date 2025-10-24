<br />
<p align="center">

  <h3 align="center">Map Generator</h3>
    <br />
  <p align="justify">
    This tool procedurally generates images of city maps. The process can be automated, or controlled at each stage give you finer control over the output. 3D models of generated cities can be downloaded as a `.stl`. The download is a `zip` containing multiple `.stl` files for different components of the map. Images of generated cities can be downloaded as a `.png` or an `.svg`. There are a few choices for drawing style, ranging from colour themes similar to Google or Apple maps, to a hand-drawn sketch.
    <br />
    <br />
    <a href="https://karadagi.github.io/MapGenerator/"><strong>Open Generator »</strong></a>
    <br />
    <br />
  </p>
</p>

### Built With

* [Typescript](https://www.typescriptlang.org/)
* [Gulp](https://gulpjs.com/)


## Getting Started

To get a local copy up and running follow these steps.

### Prerequisites


* npm
```sh
npm install npm@latest -g
```

* Gulp
```
npm install --global gulp-cli
```

### Installation
 
1. Clone the mapgenerator
```sh
git clone https://github.com/karadagi/MapGenerator.git
```
2. Install NPM packages
```sh
cd mapgenerator
npm install
```
3. Build with Gulp. This will watch for changes to any Typescript files. If you edit the HTML or CSS you will have to rerun this command. [Gulp Notify](https://github.com/mikaelbr/gulp-notify) sends a notification whenever a build finishes.
```
npx gulp
```
4. Open `dist/index.html` in a web browser, refresh the page with ctrl+shift+r whenever the project is rebuilt.


## Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


## Original Repository

Link: [https://github.com/probabletrain/mapgenerator](https://github.com/probabletrain/mapgenerator)



## License

Distributed under the LGPL-3.0 License. See `COPYING` and `COPYING.LESSER` for more information.
