import PrintComponent from './componnents/SunmiPrinter'
import { textToPrint } from './constant'

function App() {
  return <PrintComponent content={textToPrint}/>
}

export default App
