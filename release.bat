@echo off
setlocal enabledelayedexpansion

for /f "tokens=2 delims=:," %%i in ('findstr /R /C:"\"version\"" "e:\Apps\UnderFlow\package.json"') do (
    set "version=%%i"
    set "version=!version: =!"
    set "version=!version:"=!"
)

echo Committing with version: !version!

git add .
git commit -m "Release version !version!"
git push

endlocal
