#!/usr/bin/env node
/*
 * ilib-assemble.js - Scan an application looking for references to ilib
 * classes and then assembling the locale data for those classes into
 * files that can be included in webpack
 *
 * Copyright © 2022 JEDLSoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import OptionsParser from 'options-parser';
import Locale from 'ilib-locale';
import { JSUtils } from 'ilib-common';
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';

import walk from './walk.mjs';
import scan from './scan.mjs';
import scanModule from './scanmodule.mjs';

const optionConfig = {
    help: {
        short: "h",
        help: "This help message",
        showHelp: {
            banner: 'Usage: ilib-assemble [-h] [options] outputPath [input_file_or_directory ...]',
            output: console.log
        }
    },
    compressed: {
        short: "c",
        flag: true,
        help: "Whether you want the output to be compressed/minified."
    },
    format: {
        short: "f",
        "default": "js",
        help: "What format do you want the output data to be in. Choices are 'cjs' for a commonjs file, 'js' for an ESM module, or 'json' for a plain json file. Default is 'js'."
    },
    locales: {
        short: "l",
        "default": "en-AU,en-CA,en-GB,en-IN,en-NG,en-PH,en-PK,en-US,en-ZA,de-DE,fr-CA,fr-FR,es-AR,es-ES,es-MX,id-ID,it-IT,ja-JP,ko-KR,pt-BR,ru-RU,tr-TR,vi-VN,zxx-XX,zh-Hans-CN,zh-Hant-HK,zh-Hant-TW,zh-Hans-SG",
        help: "Locales you want your webapp to support. Value is a comma-separated list of BCP-47 style locale tags. Default: the top 20 locales on the internet by traffic."
    },
    module: {
        short: "m",
        multi: true,
        help: "Explicitly add the locale data for a module that is not otherwise mentioned in the source code. Parameter gives a relative path to the module, including the leading './'. Typically, this would be in ./node_modules, but it could be anywhere on disk. This option may be specified multiple times, once for each module to add." 
    },
    quiet: {
        short: "q",
        flag: true,
        help: "Produce no progress output during the run, except for error messages."
    }
};

const options = OptionsParser.parse(optionConfig);

if (options.args.length < 1) {
    console.log("Error: missing output path parameter");
    OptionsParser.help(optionConfig, {
        banner: 'Usage: ilib-assemble [-h] [options] outputPath [input_file_or_directory ...]',
        output: console.log
    });
    process.exit(1);
}

if (!options.opt.quiet) console.log("ilib-assemble - Copyright (c) 2022 JEDLsoft, All rights reserved.");

const outputPath = options.args[0];
let stat;
try {
    stat = fs.statSync(outputPath);
} catch (e) {}

if (!stat) {
    // file not found, so let's make it
    mkdirp(outputPath);
    if (!options.opt.quiet) console.log(`Created output path: ${outputPath}`);
} else if (stat.errno) {
    console.log(`Could not access ${outputPath}`);
    console.log(stat);
    process.exit(2);
} else if (!stat.isDirectory()) {
    console.log(`${outputPath} is a file, not a directory.`);
    process.exit(3);
}

let paths = options.args.slice(1);
if (paths.length === 0) {
    paths.push(".");
}

if (options.opt.locales) {
    options.opt.locales = options.opt.locales.split(/,/g);
}
if (!options.opt.format) {
    options.opt.format = "js";
}

if (!options.opt.quiet) console.log(`Assembling data for locales: ${options.opt.locales.join(", ")}`);

if (!options.opt.quiet) console.log(`\n\nScanning input paths: ${JSON.stringify(paths)}`);

let files = [];

paths.forEach((pathName) => {
    if (!options.opt.quiet) console.log(`  Scanning ${pathName} for Javascript files...`);
    files = files.concat(walk(pathName, options.opt));
});

let ilibModules = new Set();

if (!options.opt.quiet) console.log(`\n\nScanning javascript files...`);

files.forEach((file) => {
    if (!options.opt.quiet) console.log(`  ${file} ...`);
    scan(file, ilibModules);
});

if (options.opt.module) {
    options.opt.module.forEach(module => {
        if (!options.opt.quiet) console.log(`\nAdding module ${module} to the list of modules to search`);
        ilibModules.add((module[0] === '.') ? path.join(process.cwd(), module) : module);
    });
}

let localeData = {};

if (!options.opt.quiet) console.log(`\n\nScanning ilib modules for locale data`);
let promise = Promise.resolve(false);
ilibModules.forEach((module) => {
    if (!options.opt.quiet) console.log(`  Scanning module ${module} ...`);
    promise = promise.then(result => {
        return scanModule(module, options.opt).then(data => {
            if (data) {
                localeData = JSUtils.merge(localeData, data);
                return true;
            }
            return result;
        });
    });
});

promise.then(result => {
    //console.log(`localeData is: ${JSON.stringify(localeData, undefined, 4)}`);

    let hadOutput = false;
    if (result) {
        if (!options.opt.quiet) console.log("\n\nWriting out data...");

        for (let locale in localeData) {
            const contents = localeData[locale];
            const outputName = path.join(outputPath, `${locale}.js`);
            let contentStr = options.opt.compressed ?
                JSON.stringify(contents) :
                JSON.stringify(contents, undefined, 4);
            switch (options.opt.format) {
                case 'js':
                    contentStr = `export default const data = ${contentStr};`;
                    break;
                case 'cjs':
                    contentStr = `module.exports = ${contentStr};`;
                    break;
            }
            if (contentStr.length) {
                fs.writeFileSync(outputName, contentStr, "utf-8");
                hadOutput = true;
            }
        }
        if (hadOutput) {
            if (!options.opt.quiet) console.log(`Done. Output is in ${outputPath}.`);
            return true;
        }
    }
    if (!options.opt.quiet) console.log("Done. No locale data found.");
});

