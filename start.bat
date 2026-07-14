@echo off
echo.
echo  ============================================================
echo   CineGuard - Movie Parental Guide + Letterboxd Sorter
echo  ============================================================
echo.
echo  Starting server...
echo  Open http://localhost:5000 in your browser
echo.
set FLASK_SKIP_DOTENV=1
python server.py
pause
