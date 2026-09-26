"""Compatibility entry point for the single allowlisted public builder."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[1]/'build.py'),run_name='__main__')
