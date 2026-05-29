# AVAListener System Package Audit
Generated: 2026-05-14
Python Version: 3.12.12 (system)
Platform: Windows x64

## Summary
This document identifies packages installed globally that are used by AVAListener.
These should be removed to ensure clean isolation in the virtual environment.

## AVAListener-Related Packages Found Globally

### Core Dependencies (HIGH PRIORITY - Remove)
- **numpy==2.4.4** - Array processing library
- **onnxruntime==1.24.3** - ONNX model inference
- **sherpa_onnx==1.13.0** - Speech recognition engine
- **sherpa-onnx-core==1.13.0** - Sherpa ONNX core library
- **sounddevice==0.5.5** - Audio I/O library
- **webrtcvad-wheels==2.0.14** - Voice activity detection
- **RapidFuzz==3.14.5** - Fuzzy string matching
- **jellyfish==1.2.1** - Phonetic string matching

### Supporting Libraries (MEDIUM PRIORITY - Remove if not used elsewhere)
- **cffi==2.0.0** - C Foreign Function Interface
- **flatbuffers==25.12.19** - Serialization library
- **protobuf==7.34.0** - Protocol buffers
- **mpmath==1.3.0** - Mathematical functions
- **sympy==1.14.0** - Symbolic mathematics
- **packaging==26.0** - Package utilities
- **colorama==0.4.6** - Cross-platform colored terminal text

## Recommended Removal Commands

### Safe to Remove (AVAListener-specific)
```bash
pip uninstall numpy onnxruntime sherpa_onnx sounddevice webrtcvad-wheels RapidFuzz jellyfish
```

### Check Before Removing (may be used by other projects)
```bash
pip uninstall cffi flatbuffers protobuf mpmath sympy packaging colorama
```

## Verification After Cleanup

After removing global packages, verify AVAListener still works:

```bash
cd AVA-Listener
.\venv\Scripts\activate
python -c "import numpy, onnxruntime, sherpa_onnx, sounddevice; print('All imports successful')"
```

## Notes

- Only remove packages that are confirmed to be unused by other projects
- If you encounter import errors after removal, reinstall the missing packages in the virtual environment
- The virtual environment in `AVA-Listener/venv/` contains all necessary dependencies with compatible versions