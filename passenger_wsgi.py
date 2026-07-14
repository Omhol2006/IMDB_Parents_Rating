import os
import sys

# Tell Passenger to use the virtual environment's Python if it exists
# (Shared hosts often require this to pick up pip packages)
venv_site_packages = os.path.join(os.path.dirname(__file__), 'venv', 'lib', 'python3.9', 'site-packages')
if os.path.exists(venv_site_packages):
    sys.path.insert(0, venv_site_packages)

from server import app as application
