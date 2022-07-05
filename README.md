# ilib-assemble

Tool to assemble ilib locale data from various ilib packages into single
locale files so that all of the data for a single locale can be loaded
quickly and efficiently. The single files are also useful for webpack, and
replace the functionality previously provided by the old ilib-webpack-loader
and ilib-webpack-plugin extensions to webpack.

## Installation

```
npm install ilib-assemble

or

yarn add ilib-assemble
```

Then, in your package.json, add a script:

```
"scripts": {
    "assemble": "ilib-assemble locale"
}
```

Please note: nodejs version 16 or above is required to run this tool, as it
is written with ESM modules.

## Purpose

The purpose of the ilib-assemble tool is to find out which ilib packages
your application uses, and then assemble together the locale data from those
ilib packages for the requested list of locales into single files so
that they can be loaded quickly or so that they can be included into webpack
bundles easily.

The idea is that your build system should run this tool each time you build
your product so that it has the correct locale data each time. This way, if
you start using a new ilib package, it will automatically include the locale
data for that package into your files, and from there in your webpack
bundles. (See ilib-loader and ilib-localedata)

N.B. Currently, this tool only works with the independent ilib-* packages, not
the monolithic "ilib" package itself. To include the locale data for the ilib
package into webpack, you have to use the ilib-webpack-loader and
ilib-webpack-plugin extensions to webpack.

## Basic Operation

The basic operation of the tool is this:

1. Scan your app for javascript files, including those within the node_modules.
2. Read each js file it finds in the given directories, and remember all imports and requires
   of packages that start with "ilib-"
3. For each ilib package found in step 2, figure out whether or not that package publishes
   an `assemble.mjs` file. If so, load it, and find the default function it exports. Call
   that function with the list of locales as a parameter, and it should return all of the
   locale data required for the given locales. The data returned should look like this:
    ```json
    {
      "en-US": {
        "package-basename": { American locale data here }
      },
      "ko-KR": {
        "package-basename": { Korean locale data here }
      },
      [etc]
    }
    ```
   The idea is that the `assemble.mjs` module that comes with each ilib-* package contains
   the know-how of assembling the locale data for that package so that the ilib-assemble
   tool doesn't need deep knowledge of each ilib-* package.
4. Merge the data from each call in step 3 together into one big piece of data. This creates
   data like this (with 3 example basenames):
    ```json
    {
      "en-US": {
        "localeinfo": { American locale info },
        "datefmt": { American date formats },
        "numfmt": { American number formats }
      },
      "ko-KR": {
        "localeinfo": { Korean locale info },
        "datefmt": { Korean date formats },
        "numfmt": { Korean number formats }
      }
    }
    ```
5. For each locale from step 4, write out a file with that data either in json form
    or as an ESM or CommonJS module. ie. outputDir/en-US.js, outputDir/ko-KR.js

The data can then be loaded by the ilib-localedata package for use in the various ilib-*
packages.

## Usage

```
ilib-assemble [options] output-dir [input-dir-or-file ...]
```

The ilib-assemble tool takes the following options:

- --format or -f. Specify the format of the output files. This can be one of:
    - json: the output files should be written in plain json form
    - js: the output should be written as an ESM module that exports a
      default function which returns the locale data for that locale
    - cjs: the output should be written as a CommonJS module that
      exports function which returns the locale data for that locale
- --compressed or -c. The data should appear in compressed/minified form
- --locales or -l. A comma separated list of locale specifiers in BCP-47 format
  for the locales that your app supports.

The output-dir is required and specifies the directory where the output is
written. If it does not exist, it will be created first.

The input directories are optional. If not specified, the ilib-assemble tool will
start in the current directory and recursively search the directory tree from
there. If individual files are specified, only those files are searched.

## Using the ilib-assemble Output With Webpack

If you would like to use the output from ilib-assemble with webpack, you can
do so by first running the tool and putting the output into a subdirectory of your
app. The suggested directory is "locale" but you can name it anything you like.

Then, you will have to modify your webpack configuration to point the
webpack locale data loader within ilib at your directory. You do this by
creating a resolve alias in your `webpack.config.js` file:

```json
    "resolve": {
        "alias": {
            "calling-module": "./locale"
        }
    }
```

The "calling-module" alias should point to the path where the directory full
of locale files are located which were created using ilib-assemble.

Additionally, the ilib-* packages depend on a package called `ilib-loader`
which knows how to load files on various platforms. Under webpack, most of
those loader subclasses are not useful and do not need to be included in
the webpack bundles. In order to exclude them, add the following to your
`webpack.config.js`:

```json
    "externals": {
        "./NodeLoader": "NodeLoader",
        "./QtLoader": "QtLoader",
        "./RhinoLoader": "RhinoLoader",
        "./NashornLoader": "NashornLoader",
        "./RingoLoader": "RingoLoader"
    },
```

See the documentation for [ilib-loader](https://github.com/ilib-js/ilib-loader)
for more details.

## License

Copyright © 2022, JEDLSoft

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and
limitations under the License.

## Release Notes

### v1.1.0

- added the ability to add a nodule to the list of modules to include the locale
  data for. This is often used to include the locale data of the current
  package for testing.
- added the ability to get the list of locales to process from a json file
- locale data in js files now get output as a function that returns the data. That
  way you don't need any babel plugins to process exported const values.
  (ie. you don't need babel-plugin-transform-add-module-exports)
- only resolve paths to modules when they are module references. That is, they are
  not relative to the current dir nor are they absolute paths

### v1.0.0

- initial version
- Code to replace the ilib-webpack-loader and ilib-webpack-plugin by
  performing the same task, but outside of webpack.