# OrstetCore Adaptation for TSWoW

This adaptation integrates OrstetCore with TSWoW, providing support for the OrstetCore modular World of Warcraft server core.

## Key Changes

### 1. Core Support
- Added OrstetCore namespace in `tswow-scripts/compile/OrstetCore.ts` 
- Extended path definitions in `Paths.ts` to support OrstetCore build paths
- Updated `CommonCore.ts` to handle OrstetCore library copying

### 2. Build System
- Extended `CompileTsWow.ts` to support OrstetCore compilation targets:
  - `orstetcore` - default build
  - `orstetcore-release` - release build  
  - `orstetcore-debug` - debug build
  - `orstetcore-relwithdebinfo` - release with debug info
- Added CMake configuration for OrstetCore with proper module handling

### 3. Module System
OrstetCore uses a **mods** system:
- OrstetCore modules are located in `/mods/` directory
- Uses `MODULES` CMake parameter
- Modules are compiled as static/dynamic libraries like `libmods.so`
- Module configuration through `ModulesLoader.cpp` template

### 4. SQL Compatibility
- Extended SQL translation and cleaning functions to support OrstetCore
- Added `isOrstetCore()` function for core detection

### 5. Library Structure
OrstetCore includes these additional libraries:
- `libmods.so/mods.dll` - Module system library
- Standard libraries: `libcommon`, `libdatabase`, `libgame`, `libshared`

## Usage

### Building OrstetCore
```bash
# Build OrstetCore with default settings
node build.js orstetcore

# Build OrstetCore release version
node build.js orstetcore-release

# Build OrstetCore with modules disabled
node build.js orstetcore nomods

# Build with specific module configuration
node build.js orstetcore minimal
```

### Configuration
Set `EmulatorCore: orstetcore` in your dataset configuration to use OrstetCore.

Example configuration file:
```yaml
EmulatorCore: orstetcore
Modules: []
```

### Project Structure
```
cores/
  OrstetCore/           # OrstetCore source code
    src/               # Core source files
    mods/              # Module directory
    sql/               # SQL files
      updates/         # Update scripts
      custom/          # Custom SQL
```

## Differences from Traditional Cores

| Feature | OrstetCore |
|---------|------------|
| Extension System | Mods |
| CMake Parameter | MODULES |
| Library Name | libmods |
| Directory | `/mods/` |
| Loader File | ModulesLoader.cpp |

## Compatibility

This adaptation provides full support for OrstetCore. The TSWoW framework automatically detects the core configuration and uses the appropriate compilation and library paths.
