// Importing necessary functions and variables from external libraries and files
import { expose, control } from '@libreservice/my-worker'
import { pyodideURL, kernelName, kernelVersion } from '../package.json'
// Setting a boolean flag to determine whether to use the development version of SymPy
const useDevSymPy = false
// Importing Pyodide and declaring a function to load it
importScripts(pyodideURL)
let pyodide: any
declare const loadPyodide: () => Promise<any>
// Creating a control function to track the progress of the Pyodide and package downloads
const stage = control('stage')
// Function to load Pyodide and necessary packages
async function loadPyodideAndPackages () {
// List of packages to be downloaded
const pkgs = ['micropip', 'docutils', 'matplotlib', 'numpy', 'nltk', 'typing-extensions', 'mpmath']
// Loading Pyodide and tracking the progress
pyodide = await loadPyodide()
stage({ stage: 'PYODIDE_DOWNLOADED' })
// Downloading and installing the packages, and tracking the progress
await pyodide.loadPackage(pkgs).catch((e: Error) => {
stage({ errorMsg: e.message })
self.close()
})
stage({ stage: 'PKG_DOWNLOADED' })
// Registering a JavaScript module with Pyodide
const config = { kernelName, kernelVersion, useDevSymPy }
pyodide.registerJsModule('config', config)
// Running Python code to download additional packages and set up the environment
  await pyodide.runPythonAsync(`
    from pathlib import Path
    from config import kernelName, kernelVersion, useDevSymPy
    import micropip
    from pyodide.http import pyfetch
    if useDevSymPy:
        await micropip.install('/sympy-1.11.dev0-py3-none-any.whl')
    else:
        await micropip.install('sympy==1.11')
    words_res = await pyfetch('/words.zip')
    path = Path('/home/pyodide/nltk_data/corpora')
    path.mkdir(parents=True)
    with open(path/'words.zip', 'wb') as f:
        f.write(await words_res.bytes())
    await micropip.install([f'/{kernelName}-{kernelVersion}-py3-none-any.whl',
        'cplot',
        '/antlr4_python3_runtime-4.10-py3-none-any.whl'])
    from api import eval_input, eval_latex_input, eval_card as eval_card_inner, get_sympy_version
    def eval_card(card_name, expression, variable, parameters):
        return eval_card_inner(card_name, expression, variable, parameters.to_py())
  `)
  stage({ stage: 'KERNEL_LOADED' })
}

// Starting the Pyodide download and package installation process
const pyodideReadyPromise = loadPyodideAndPackages()
// Function to wrap Pyodide functions and convert Python objects to JavaScript objects
function wrapper (name: string) {
return (...args: any[]) => {
let result = pyodide.globals.get(name)(...args)
if (pyodide.isPyProxy(result)) {
const tempResult = result
result = result.toJs({ dict_converter: Object.fromEntries })
tempResult.destroy()
}
return result
}
}
// Wrapping Pyodide functions to be exposed to the main thread
const evalInput = wrapper('eval_input')
const evalLatexInput = wrapper('eval_latex_input')
const evalCard = wrapper('eval_card')
const getSymPyVersion: () => Promise<string> = wrapper('get_sympy_version')
// Function to get the version of Pyodide
function getPyodideVersion (): string {
return pyodide.version
}
// Exposing the wrapped Pyodide functions and the Pyodide version to the main thread
expose({ evalInput, evalLatexInput, evalCard, getPyodideVersion, getSymPyVersion }, pyodideReadyPromise)