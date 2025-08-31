/*
 * This file is part of tswow (https://github.com/tswow)
 *
 * Copyright (C) 2020 tswow <https://github.com/tswow/>
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { SevenZip } from '../util/7zip';
import { Args } from '../util/Args';
import { BuildType } from '../util/BuildType';
import { wfs } from '../util/FileSystem';
import { ipaths, TDB_URL } from '../util/Paths';
import { isWindows } from '../util/Platform';
import { wsys } from '../util/System';
import { term } from '../util/Terminal';
import { copyExtLibs } from './CommonCore';
import { bpaths, spaths } from './CompilePaths';
import { DownloadFile } from './Downloader';

// https://stackoverflow.com/a/68703218/17188274
function prefix(words: string[]){
    // check border cases size 1 array and empty first word)
    if (!words[0] || words.length ==  1) return words[0] || "";
    let i = 0;
    // while all words have the same character at position i, increment i
    while(words[0][i] && words.every(w => w[i] === words[0][i]))
      i++;

    // prefix is the substring from the beginning to the last successfully checked i
    return words[0].substr(0, i);
}

function suffix(words: string[]) {
    return prefix(words.map(x=>x.split('').reverse().join(''))).split('').reverse().join('')
}

export namespace OrstetCore {
    export function headers(globalOnly: boolean) {
        spaths.tswow_core.Public.copy(ipaths.bin.include, true)

        if(!globalOnly) {
            let sol_sourcedir = [
                bpaths.OrstetCore.sol_headers
            ].find(x=>x.exists())

            if(!sol_sourcedir) {
                throw new Error(`Can't build headers: no sol2 headers found (you need to build a core first)`)
            }

            sol_sourcedir.copy(ipaths.bin.include);
            bpaths.OrstetCore.lua_headers.iterateDef(node=>{
                if(node.endsWith('.h')) {
                    node.copy(ipaths.bin.include.lua.join(node.basename()));
                }
            })

            bpaths.OrstetCore.tracy_source.tracy_header.copy(ipaths.bin.include.tracy.tracy_hpp);
            [bpaths.OrstetCore.tracy_source.common,bpaths.OrstetCore.tracy_source.client].forEach(x=>{
                x.iterateDef((node)=>{
                    if(node.endsWith('.hpp') || node.endsWith('.h')) {
                        node.copy(ipaths.bin.include.tracy.join(x.basename(),node.basename()))
                    }
                });
            });
        }

        spaths.misc.client_extensions.CustomPackets
            .readDir('ABSOLUTE')
            .filter(x=>x.endsWith('.h'))
            .forEach(x=>x.copy(ipaths.bin.include.join(x.basename())))

        // write enums
        let gdts = spaths.tswow_core.Public.global_d_ts.read('utf-8')
        let tcFiles: string[] = []
        spaths.cores.OrstetCore.src.iterate('RECURSE','FILES','FULL',name=>{
            tcFiles.push(name.get());
        })
        spaths.tswow_core.iterate('RECURSE','FILES','FULL',name=>{
            tcFiles.push(name.get());
        })

        let readFiles: {[key: string]: string} = {}
        let missingEnums: string[] = []
        gdts = gdts.split('\n').map(x=>{
            let match = x.match(/declare +const +enum +([a-zA-Z_][a-zA-Z_0-9]*) +{.*?} +\/\*\* +(.+?):([a-zA-Z_][a-zA-Z_0-9]*).*/)
            if(match) {
                let declName = match[1]
                let filePath = match[2];
                let enumName = match[3];

                if(filePath.startsWith('./')) {
                    filePath = filePath.substring(2);
                }

                let isFile = false;
                for(let tcFile of tcFiles) {
                    if(tcFile.includes(filePath)) {
                        if(readFiles[tcFile] === undefined) {
                            readFiles[tcFile] = wfs.read(tcFile);
                        }
                        let contents = readFiles[tcFile];
                        let enumMatch = contents.match(new RegExp(`enum\\s+${enumName}\\s*\\n?\\s*{([^}]*)}`,'gm'));
                        if(enumMatch) {
                            isFile = true;
                            let entries = enumMatch[0]
                                .split('{')[1].split('}')[0]
                                .split('\n')
                                .map(x=>x.trim())
                                .filter(x=>x.length > 0 && !x.startsWith('//') && !x.startsWith('/*'))
                                .map(x=>{
                                    if(x.includes('//')) {
                                        x = x.substring(0,x.indexOf('//'))
                                    }
                                    return x.trim();
                                })
                                .filter(x=>x.length>0)
                                .map(x=>x.endsWith(',')?x.substring(0,x.length-1):x)
                            if(entries.length>0) {
                                let def = `declare const enum ${declName} {\n    `
                                    + entries.join(',\n    ')
                                    +'\n}'
                                return def;
                            }
                        }
                    }
                }

                if(!isFile) {
                    missingEnums.push(x);
                }
            }
            return x;
        }).join('\n');

        if(missingEnums.length > 0) {
            console.log(`Warning: Could not find the following enums:`)
            console.log(`  - ` + missingEnums.join('\n  - '))
        }

        ipaths.bin.include.global_d_ts.write(gdts);

        spaths.misc.install_config.include_addon.Events_ts.copy(ipaths.bin.include_lua);
        spaths.misc.install_config.include_addon.global_d_ts.copy(ipaths.bin.include_lua);
        spaths.misc.install_config.include_addon.shared_global_d_ts.copy(ipaths.bin.include_lua);
        spaths.misc.install_config.include_addon.LualibBundle_lua.copy(ipaths.bin.include_lua);
        spaths.misc.install_config.include_addon.RequireStub_lua.copy(ipaths.bin.include_lua);

        // Remove old lua scripts
        ipaths.bin.scripts.forEach((k,ep)=>{
            if(ep.index.lua.exists()) {
                ep.index.lua.remove();
            }

            if(ep.lua.exists()) {
                ep.lua.remove();
            }

            ep.iterateDef((file)=>{
                if(file.endsWith('.lua') && file.basename() !== 'LualibBundle.lua' && file.basename() !== 'RequireStub.lua') {
                    file.remove();
                }
            });

            // Copy lua scripts
            ep.iterate('SHALLOW','DIRECTORIES','ABSOLUTE', (addonPath) => {
                let luaPath = addonPath.join('lua');
                if (luaPath.exists()) {
                    luaPath.iterate('RECURSE','FILES','ABSOLUTE', (luaFile) => {
                        if (luaFile.endsWith('.lua')) {
                            luaFile.copy(ep.lua.join(luaFile.relativeFrom(luaPath).get()));
                        }
                    });
                }

                // Copy addon config files
                let cfgFiles = addonPath.readDir('ABSOLUTE').filter(x=>x.endsWith('.ts') || x.endsWith('.json'));
                cfgFiles.forEach(cfgFile=>{
                    if(cfgFile.exists()) {
                        cfgFile.copy(ep.join(cfgFile.basename()));
                    }
                })

                if(ep.index.lua.exists()) {
                    let indexContents = ep.index.lua.read('utf-8');
                    let lines = indexContents.split('\n');
                    lines.forEach((line,i)=>{
                        if(line.includes('require("lua.') && !line.includes('--')) {
                            lines[i] = '-- ' + lines[i] + ' (removed by header generation)';
                        }
                    })

                    ep.index.lua.write(lines.join('\n'));
                }

                let globalLua = ep.lua.join('global.lua');
                if(globalLua.exists()) {
                    globalLua.remove();
                }

                if(ep.lua.exists()) {
                    ep.lua.iterate('RECURSE','FILES','ABSOLUTE',(luaFile)=>{
                        if(luaFile.endsWith('.lua')) {
                            let contents = luaFile.read('utf-8');
                            if(contents.includes('CreateFrame')) {
                                luaFile.write(
                                      'if not GetLocale then\n'
                                    + '    GetLocale = function() return "enUS" end\n'
                                    + 'end\n'
                                    + 'if not CreateFrame then\n'
                                    + '    CreateFrame = function() return {} end\n'
                                    + 'end\n'
                                    + contents
                                );
                            }
                        }
                    });
                }
            });
        });
    }

    export async function install(cmake: string, openssl: string, mysql: string, type: BuildType, args1: string[]) {
        //
        // Tracy
        //
        const tracyEnabled = Args.hasFlag(['tracy','tracy-enable'],[process.argv,args1])

        if(Args.hasFlag('notc',[process.argv,args1])) {
            return;
        }

        term.log('build','Building OrstetCore');
        bpaths.OrstetCore.mkdir()

        // We no longer make non-dynamic builds.
        const modules = Args.hasFlag('minimal',[process.argv,args1])
            ? `minimal-dynamic`
            : args1.includes('nomods')
            ? 'none'
            : 'dynamic';

        const tools = args1.includes('notools') ? '0' : '1';
        const generateOnly = args1.includes('--generate-only')

        let setupCommand: string;
        let buildCommand: string;

        if(!Args.hasFlag('no-compile',[process.argv,args1])) {
            if (isWindows()) {
                setupCommand = `${cmake} -G "Visual Studio 17 2022" -DTOOLS=${tools}`
                +` -DCMAKE_GENERATOR="Visual Studio 17 2022"`
                +` -DMODULES=${modules}`
                +` -DMYSQL_INCLUDE_DIR="${mysql}/include"`
                +` -DMYSQL_LIBRARY="${mysql}/lib/libmysql.lib"`
                +` -DOPENSSL_INCLUDE_DIR="${wfs.absPath(openssl)}/include"`
                +` -DOPENSSL_ROOT_DIR="${wfs.absPath(openssl)}"`
                +` -DBOOST_ROOT="${bpaths.boost.boost_1_82_0.abs().get()}"`
                +` -DTRACY_ENABLE="${tracyEnabled?'ON':'OFF'}"`
                +` -DBUILD_SHARED_LIBS="ON"`
                +` -DTRACY_TIMER_FALLBACK="${!Args.hasFlag('tracy-better-timer',[process.argv,args1])?'ON':'OFF'}"`
                +` -DBUILD_TESTING="OFF"`
                +` -S "${spaths.cores.OrstetCore.get()}"`
                +` -B "${bpaths.OrstetCore.get()}"`;
                buildCommand = `${cmake} --build ${bpaths.OrstetCore.get()} --config ${type}`;
                wsys.exec(setupCommand, 'inherit', {env: {BOOST_ROOT:`${bpaths.boost.boost_1_82_0.abs().get()}`,...process.env}});
                if(generateOnly) return;
                wsys.exec(buildCommand, 'inherit');
            } else {
                bpaths.OrstetCore.mkdir();
                const relSource = bpaths.OrstetCore
                    .relativeFrom(spaths.cores.OrstetCore)
                const relInstall = bpaths.OrstetCore
                    .relativeFrom(bpaths.OrstetCore.join('install','orstetcore'))
                // TODO: Set up optimization flags for o0 as debug and o3 as release
                setupCommand = `cmake ${relSource}`
                +` -DCMAKE_INSTALL_PREFIX=${relInstall}`
                +` -DCMAKE_C_COMPILER=/usr/bin/clang`
                +` -DCMAKE_CXX_COMPILER=/usr/bin/clang++`
                +` -DBUILD_SHARED_LIBS="ON"`
                +` -DBUILD_TESTING="OFF"`
                +` -DTRACY_ENABLED="${Args.hasFlag('tracy',[process.argv,args1])}"`
                +` -DTRACY_TIMER_FALLBACK="${!Args.hasFlag('tracy-timer-fallback',[process.argv,args1])?'ON':'OFF'}"`
                +` -DWITH_WARNINGS=1`
                +` -DMODULES=${modules}`;
                buildCommand = 'make -j 4';
                await bpaths.OrstetCore.doIn(() => {
                    wsys.exec(setupCommand, 'inherit');
                    if(generateOnly) return;
                    wsys.exec(buildCommand, 'inherit');
                    wsys.exec('make install', 'inherit');
                })
                if(generateOnly) return;
            }
        } else {
            term.log('build','Skipped compiling OrstetCore')
        }

        term.log('build','Copying libraries')
        if(isWindows()) {
            bpaths.OrstetCore.bin(type).mods
                .copy(ipaths.bin.core.pick('orstetcore').build.pick(type).mods)

            bpaths.OrstetCore.configs(type).iterate('FLAT','FILES','FULL',node=>{
                if(node.endsWith('.dll') || node.endsWith('.conf.dist') || node.endsWith('.pdb') || node.endsWith('.exe')) {
                    node.copy(ipaths.bin.core.pick('orstetcore').build.pick(type).configs.join(node.basename()))
                }
            })
            bpaths.OrstetCore.tracy_dll(type)
                .copy(ipaths.bin.core.pick('orstetcore').build.pick(type).tracy_client);
        } else {
            [
                  bpaths.OrstetCore.lib_linux
                , bpaths.OrstetCore.bin_linux
                , bpaths.OrstetCore.etc_linux
            ].forEach(x=>x.copy(ipaths.bin.core.pick('orstetcore').build.pick(type)))
        }

        if(isWindows()) {
            bpaths.OrstetCore.libraries(type).forEach(x=>{
                if(x.exists()) {
                    if(x.endsWith('.lib') || x.endsWith('.pdb')) {
                        x.copy(ipaths.bin.core.pick('orstetcore').build.pick(type).libs.join(x.basename()));
                    } else if(x.endsWith('.dll') || x.endsWith('.exe')) {
                        x.copy(ipaths.bin.core.pick('orstetcore').build.pick(type).join(x.basename()));
                    }
                }
            })
        }

        // Copy mysql/ssl/cmake libraries
        copyExtLibs('orstetcore', type)

        // Revision
        let rev = wsys.exec(`git log --pretty=format:"%h %cI %s" -1`,{
            cwd: spaths.cores.OrstetCore.get()
        }).toString();
        ipaths.bin.revisions.orstetcore.write(rev)

        // Sql files
        spaths.cores.OrstetCore.sql.updates.copy(ipaths.bin.sql.updates)
        spaths.cores.OrstetCore.sql.custom.copy(ipaths.bin.sql.custom)

        if (!ipaths.bin.tdb.exists()) {
            term.log('build', 'Downloading TDB');
            await DownloadFile(TDB_URL, bpaths.TDB_7z.abs().get())
            term.log('build', 'Extracting TDB');
            SevenZip.extract(
                bpaths.TDB_7z.abs().get()
                , bpaths.abs().get()
            )
            wfs.iterate(bpaths.get(), 'SHALLOW', 'FILES', 'ABSOLUTE', (x) => {
                if (x.basename().startsWith('TDB_full_world') && x.basename().endsWith('.sql')) {
                    x.copy(ipaths.bin.tdb);
                }
            })
        }
    }
}
