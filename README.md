# Taskamina

Taskamina is a local-first daily task planner that helps you compare planned work with an estimated energy budget. Add tasks or rest periods, preview their impact on the energy bar, and record what actually happened when you finish them.

Energy values are planning estimates, not measurements of physical or mental health.

## Current features

- Create a plan for a selected day and complete a daily check-in.
- Add work tasks with duration and intensity estimates.
- Add rest periods to the task list and preview their estimated recovery.
- Reorder tasks without locking their completion order.
- Mark tasks or rest periods as finished.
- Record task feedback and view an activity log.
- Store data locally in SQLite. No account or cloud service is required.

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI, Python
- Database: SQLite
- Windows desktop beta: PyInstaller and pywebview

## Download the Windows beta

Download `Taskamina.exe` from the [Releases page](https://github.com/truonglehuyhoang/taskamina/releases). Run the executable and choose a local data folder on first launch. No Python or Node.js installation is required to use the prebuilt executable.

This is a Windows beta, not an installer. For development or building from source, follow the instructions below.

## Run for development

Requirements: Python 3.13, Node.js and npm.

Clone the repository and install dependencies from the project root:

```powershell
git clone https://github.com/truonglehuyhoang/taskamina.git
cd taskamina

py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r server/requirements.txt
npm --prefix client ci
```

Start the backend in one terminal:

```powershell
cd server
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8080
```

Start the frontend in another terminal from the project root:

```powershell
npm --prefix client run dev
```

Open the URL shown by Vite, normally `http://localhost:5173`.

The backend runs database migrations automatically at startup. The development database is stored at `server/data/taskamina.db`.

## Build the Windows desktop beta

Run these commands from the project root:

```powershell
.\.venv\Scripts\python.exe -m pip install -r server/requirements-build.txt
npm --prefix client run build
.\.venv\Scripts\python.exe -m PyInstaller --noconfirm Taskamina.spec
```

The executable is created at `dist/Taskamina.exe`. Build the frontend **before** running PyInstaller, because the executable bundles the files from `client/dist`.

On first launch, Taskamina asks where to store its data. It remembers that folder for future launches. To choose another folder later:

```powershell
.\dist\Taskamina.exe --choose-data
```

To open the desktop build in the default browser instead of its app window:

```powershell
.\dist\Taskamina.exe --browser
```

This is a Windows beta build, not an installer. The `.exe` and the SQLite database are separate; deleting the `.exe` does not delete user data.

## Local data

- Web development: `server/data/taskamina.db`
- Desktop default: `%LOCALAPPDATA%\Taskamina\data\taskamina.db`
- Desktop custom location: the folder selected by the user
- Desktop location setting: `%LOCALAPPDATA%\Taskamina\settings.json`

When changing to an empty folder, Taskamina copies the existing SQLite database and keeps the original. If the selected data folder is unavailable, the app warns the user instead of silently creating a new database at the default location.

Do not commit SQLite databases, user data, `.venv`, `client/dist`, or `dist` to Git.

## Tests

Install development dependencies if they are not already installed:

```powershell
.\.venv\Scripts\python.exe -m pip install -r server/requirements-dev.txt
```

Run the backend tests from the project root:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s server/tests -v
```

Check the frontend:

```powershell
npm --prefix client run lint
npm --prefix client run build
```
