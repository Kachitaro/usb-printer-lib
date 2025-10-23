import PrintComponent from './componnents/SunmiPrinter'
import { textToPrint } from './constant'

function App() {
  return (
    <>
      <h1>Vite + React</h1>
      <PrintComponent content={textToPrint}/>
    </>
  )
}

export default App
