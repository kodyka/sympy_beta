// Importing necessary functions and variables from external libraries and files
import { expose, control } from '@libreservice/my-worker'
import { pyodideURL } from '../package.json'
// Importing Pyodide and declaring a function to load it
importScripts(pyodideURL)
let pyodide: any
declare const loadPyodide: () => Promise<any>
// Declaring variables for Pyodide console functionality
let awaitFut: any
let pyconsole: any
let reprShorten: any
let clearConsole: () => void
// Creating control functions to track the progress of the Pyodide and package downloads, and to interact with the console
const stage: (banner: string) => void = control('stage')
const setPrompt: (incomplete: boolean) => void = control('setPrompt')
const echo: (arg: string, option?: { newline: boolean }) => void = control('echo')
const error: (arg: string) => void = control('error')
// Function to load Pyodide and necessary packages, and set up the console
async function loadPyodideAndPackages() {
  // Loading Pyodide and micropip package
  pyodide = await loadPyodide()
  await pyodide.loadPackage(['micropip'])
  // Creating a namespace for Pyodide console functionality
  const namespace = pyodide.globals.get('dict')()
  // Running Python code to install SymPy, set up the console, and clear it
  await pyodide.runPythonAsync(`
    import micropip
    await micropip.install('sympy==1.11')
    import sys
    from pyodide.ffi import to_js
    from pyodide.console import PyodideConsole, repr_shorten, BANNER
    import __main__
    pyconsole = PyodideConsole(__main__.__dict__)
    import builtins
    async def await_fut(fut):
        res = await fut
        if res is not None:
            builtins._ = res
        return to_js([res], depth=1)
    def clear_console():
        pyconsole.buffer = []
  `, { globals: namespace })
  // Setting up console functionality and tracking the progress
  reprShorten = namespace.get('repr_shorten')
  stage(namespace.get('BANNER'))
  awaitFut = namespace.get('await_fut')
  pyconsole = namespace.get('pyconsole')
  pyconsole.stdout_callback = (s: string) => echo(s, { newline: false })
  pyconsole.stderr_callback = (s: string) => error(s.trimEnd())
  clearConsole = namespace.get('clear_console')
  namespace.destroy()
}
// Starting the Pyodide download and package installation process
const pyodideReadyPromise = loadPyodideAndPackages()
// Function to execute a command in the console
async function execute(command: string) {
  // Splitting the command into lines and executing each line separately
  for (const line of command.split('\n')) {
    // Pushing the line to the console and setting the prompt based on whether the syntax is incomplete
    const fut = pyconsole.push(line)
    setPrompt(fut.syntax_check === 'incomplete')
    // Handling different syntax check results
    switch (fut.syntax_check) {
      case 'syntax-error':
        error(fut.formatted_error.trimEnd())
        continue
      case 'incomplete':
        continue
      case 'complete':
        break
      default:
        throw new Error(`Unexpected type ${fut.syntax_check}`)
    }

    // Wrapping the future in a promise and handling the result
    const wrapped = awaitFut(fut)
    try {
      const [value] = await wrapped
      if (value !== undefined) {
        // Shortening and printing the output
        echo(reprShorten.callKwargs(value, {
          separator: '\n[[;orange;]<long output truncated>]\n'
        }))
      }
      if (pyodide.isPyProxy(value)) {
        value.destroy()
      }
    } catch (e: any) {
      // Handling Python errors
      if (e.constructor.name === 'PythonError') {
        const message = fut.formatted_error || e.message
        error(message.trimEnd())
      }
    } finally {
      // Destroying the future and wrapped promise
      fut.destroy()
      wrapped.destroy()
    }
  }
}

// Function to get autocomplete suggestions for a given argument
function complete(arg: string): string[] {
  return pyconsole.complete(arg).toJs()[0]
}
// Function to clear the console
function keyboardInterrupt() {
  return clearConsole() // dynamic binding after pyodide loaded
}
// Exposing the console functions to the main thread
expose({ execute, complete, keyboardInterrupt }, pyodideReadyPromise)
