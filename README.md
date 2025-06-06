# EnviroAtlas Database

[<img src="https://enviroatlas.epa.gov/enviroatlas/interactivemap/images/logo.png"     title="EnviroAtlas" width=400 >](https://www.epa.gov/enviroatlas)

A Repository for the EnviroAtlas Database

Code in this repository hydrates the EnviroAtlas mapping application (https://enviroatlas.epa.gov/enviroatlas/interactivemap/) user interface and mapping functionality. 
- changes - this folder tracks changes to the SQLite db
- config - this folder describes configurations for scripts
- db - this folder contains SQLite db 
- scripts - this folder contains scripts to maintain and export db contents for the EA mapping application.
        To execute, you must have node >20.9.0 installed and run node ./scripts/db-csv-changes.js

## How to use db-csv-changes script
1. Open a command prompt. 
2. Change directory to the location of the repo file \EnviroAtlas_DB\scripts
3. Call the script without arguments. Run `node db-csv-changes` to see more detailed help printed to the command prompt.
4. To export EnviroAtlas v3 configuration data, run `db-csv-changes export prod --exportType=ea --exportFile=<wab config file path>`. The exported config file is saved by default to the \EnviroAtlas_DB\scripts folder.
5. Load into [v3 mapping application](https://github.com/USEPA/EnviroAtlas_JSApp/tree/main/widgets/SimpleSearchFilter) as `config-layer.json`


## Branches
Please note, branches are under development and have not been fully QA/QC'ed.


## License
MIT License

Copyright (c) 2024 U.S. Federal Government (in countries where recognized)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## EPA Disclaimer
*The United States Environmental Protection Agency (EPA) GitHub project code is provided on an "as is" basis and the user assumes responsibility for its use.  EPA has relinquished control of the information and no longer has responsibility to protect the integrity, confidentiality, or availability of the information.  Any reference to specific commercial products, processes, or services by service mark, trademark, manufacturer, or otherwise, does not constitute or imply their endorsement, recommendation or favoring by EPA.  The EPA seal and logo shall not be used in any manner to imply endorsement of any commercial product or activity by EPA or the United States Government.*
