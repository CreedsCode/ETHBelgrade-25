import React, { useState, useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';

// Content from your App.css
const appGlobalStyles = `
  .App {
    text-align: center;
  }

  .App-logo {
    height: 40vmin;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .App-logo {
      animation: App-logo-spin infinite 20s linear;
    }
  }

  .App-header {
    background-color: #282c34;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: calc(10px + 2vmin);
    color: white;
  }

  .App-link {
    color: #61dafb;
  }

  @keyframes App-logo-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

function App() {
  // State for the main form inputs
  const [requestAddress, setRequestAddress] = useState('');
  const [title, setTitle] = useState('');

  // New state to hold multiple receipts and their OCR data
  // Each object: { id, fileName, imageUrl, total, itemDetails, isCollapsed, isProcessing }
  const [uploadedReceipts, setUploadedReceipts] = useState([]);

  // OCR Queue States
  const [ocrQueue, setOcrQueue] = useState([]); // Stores IDs of receipts waiting for OCR
  const [currentOcrProcessId, setCurrentOcrProcessId] = useState(null); // ID of receipt currently undergoing OCR

  // UI related states
  const [isDragging, setIsDragging] = useState(false);
  // isAnyOcrLoading derived from currentOcrProcessId (true if any OCR is actively running)
  const isAnyOcrLoading = !!currentOcrProcessId;

  // Ref to hold the latest uploadedReceipts state values in performOCR
  const uploadedReceiptsRef = useRef(uploadedReceipts);
  useEffect(() => {
    uploadedReceiptsRef.current = uploadedReceipts;
  }, [uploadedReceipts]);


  // Calculate the grand total of all receipts
  const grandTotal = uploadedReceipts.reduce((sum, receipt) => {
    // Ensure receipt.total is a number and clean it (e.g., remove '$')
    const receiptTotal = parseFloat(receipt.total?.replace('$', '') || 0);
    return sum + receiptTotal;
  }, 0).toFixed(2);

  // --- useEffect to manage the OCR queue ---
  useEffect(() => {
    // If no OCR is currently running AND there are items in the queue
    if (!currentOcrProcessId && ocrQueue.length > 0) {
      const nextReceiptId = ocrQueue[0]; // Get the next ID from the queue

      // Find the receipt object to get its image URL
      const receiptToProcess = uploadedReceiptsRef.current.find(r => r.id === nextReceiptId);

      if (receiptToProcess) {
        // Mark this receipt as currently undergoing OCR
        setUploadedReceipts(prev => prev.map(r =>
          r.id === nextReceiptId ? { ...r, isProcessing: true } : r
        ));
        setCurrentOcrProcessId(nextReceiptId); // Set the current OCR ID
        // Start OCR for this receipt
        performOCR(nextReceiptId, receiptToProcess.imageUrl);
      } else {
        // If for some reason the receipt isn't found in current state, remove it from queue
        setOcrQueue(prev => prev.slice(1));
      }
    }
  }, [ocrQueue, currentOcrProcessId]); // Depend on queue and current processing ID

  // Handle multiple file processing
  const processFiles = async (files) => {
    const newReceipts = Array.from(files).map(file => {
      const id = Date.now() + Math.random(); // Simple unique ID
      const imageUrl = URL.createObjectURL(file);
      return {
        id,
        fileName: file.name,
        imageUrl,
        total: '',
        itemDetails: [],
        isCollapsed: false,
        isProcessing: false, // Initially false, OCR will set to true when its turn comes
      };
    });

    setUploadedReceipts(prevReceipts => [...prevReceipts, ...newReceipts]);
    setOcrQueue(prevQueue => [...prevQueue, ...newReceipts.map(r => r.id)]); // Add IDs to queue
  };

  const handleImageChange = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      processFiles(event.target.files);
      event.target.value = null; // Clear input field to allow re-uploading same files
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
  };

  const handleDrop = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          processFiles(event.dataTransfer.files);
          event.dataTransfer.clearData();
      }
  };


  // OCR Function using Tesseract.js (with further improved parsing)
  const performOCR = async (receiptId, imageUrl) => {
    let extractedText = '';

    try {
      const { data: { text } } = await Tesseract.recognize(
        imageUrl,
        'eng',
        {
          logger: m => console.log(m),
          // IMPORTANT: Specify CDN paths for core and language data for single-file deployment
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4.0.4/tesseract-core.wasm',
          langPath: 'https://tessdata.projectnaptha.com/4.0.0', // Ensure this CDN path is stable and correct
        }
      );
      extractedText = text;
      console.log(`OCR Raw Text for ${receiptId}:`, extractedText);

      const lines = extractedText.split('\n');
      const newItems = [];
      let currentItemId = 0;
      let calculatedTotal = 0;
      let detectedReceiptTotal = null;
      let detectedSubTotal = null;

      // New set to store lines that were identified as totals/subtotals/cash/change
      const linesToExcludeFromItems = new Set();


      // --- EVEN MORE IMPROVED Parsing Logic ---
      const currencySymbols = '[$€£Kč]'; // Extendable list of currency symbols

      // Item and price regex:
      const itemPriceRegex = new RegExp(
          `(?:^|\\s*)(.+?)\\s+${currencySymbols}?\\s*` +
          `([+-]?\\s*\\d{1,3}(?:[\\s.,]\\d{3})*(?:[.,]\\d{1,2})?)` +
          `\\s*${currencySymbols}?` +
          `\\s*$`
      );

      const ignoreKeywords = [
        'cash', 'change', 'tax', 'vat', 'discount', 'balance',
        'amount', 'due', 'receipt', 'invoice', 'platba',
        'karta', 'hotovost', 'dph', // Czech terms
        'adresa', 'telefon', 'email', 'date', 'time', 'casher', 'manager',
        'terminal', 'ref#', 'app#', 'rec#', 'thank you', 'customer signature',
        'i agree', 'city index', 'cif', 'hotel', 'shop name', 'order id', 'order #',
        'tel', 'phone', 'website', 'payment type', 'visa', 'card', 'kredit',
        'debit', 'p.m.', 'a.m.', 'chk', 'tbl', 'gst', 'iva',
        'qty', 'price', 'description', 'item', 'menu', 'bill', 'code',
        'barcode', 'ticket', 'account', 'type', 'service',
        'supermarket', 'lorem ipsum 258', 'city index 02025', 'tel.: +456-468-987-02',
        'tel.', 'manager:', 'name'
      ];

      const totalKeywords = ['total', 'sum', 'celkem', 'total due', 'grand total', 'total amount', 'tota1'];
      const subTotalKeywords = ['subtotal', 'sub-total', 'net total', 'sub tota1'];
      const cashChangeKeywords = ['cash', 'change', 'platba', 'hotovost', 'karta'];


      const createValueRegex = (keywords) => new RegExp(
          `\\b(?:${keywords.join('|')})\\b[\\s\\xA0]*:?\\s*` +
          `(${currencySymbols}?\\s*[+-]?\\s*\\d{1,3}(?:[\\s.,]\\d{3})*(?:[.,]\\d{1,2})?)` +
          `\\s*${currencySymbols}?` +
          `\\s*$`
      , 'i');

      const totalRegex = createValueRegex(totalKeywords);
      const subTotalRegex = createValueRegex(subTotalKeywords);
      const cashChangeValueRegex = createValueRegex(cashChangeKeywords);


      for (const line of lines) {
        let cleanedLine = line.trim();
        const lowerCaseLine = cleanedLine.toLowerCase();

        cleanedLine = cleanedLine.replace(/l /g, '1 ').replace(/l\./g, '1.');
        cleanedLine = cleanedLine.replace(/o/g, '0'); // Note: This might over-correct, be cautious. Consider context or more specific replacements.
        cleanedLine = cleanedLine.replace(/o\./g, '0.');
        cleanedLine = cleanedLine.replace(/s\./g, '5.');
        cleanedLine = cleanedLine.replace(/(\d)\s(\d{3}(?:[.,]\d{1,2})?)/g, '$1$2');


        const currentTotalMatch = cleanedLine.match(totalRegex);
        if (currentTotalMatch) {
            let value = currentTotalMatch[1].replace(/[^\d.,+-]/g, '');
            value = value.replace(',', '.');
            const parsedValue = parseFloat(value);
            if (!isNaN(parsedValue)) {
                detectedReceiptTotal = parsedValue.toFixed(2);
                linesToExcludeFromItems.add(cleanedLine);
            }
        }

        const currentSubTotalMatch = cleanedLine.match(subTotalRegex);
        if (currentSubTotalMatch && detectedSubTotal === null) {
            let value = currentSubTotalMatch[1].replace(/[^\d.,+-]/g, '');
            value = value.replace(',', '.');
            const parsedValue = parseFloat(value);
            if (!isNaN(parsedValue)) {
                detectedSubTotal = parsedValue.toFixed(2);
                linesToExcludeFromItems.add(cleanedLine);
            }
        }

        const isCashChangeValueLine = cashChangeValueRegex.test(cleanedLine);
        if (isCashChangeValueLine) {
            linesToExcludeFromItems.add(cleanedLine);
            continue;
        }

        if (linesToExcludeFromItems.has(cleanedLine)) {
            continue;
        }

        const shouldIgnoreGeneralLine = ignoreKeywords.some(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            return regex.test(lowerCaseLine);
        });

        if (shouldIgnoreGeneralLine || lowerCaseLine.match(/^\d+(\.\d+)?$/)) {
            continue;
        }


        const match = cleanedLine.match(itemPriceRegex);
        if (match) {
          const item = match[1].trim();
          let price = match[2].replace(/[^\d.,+-]/g, '');
          price = price.replace(',', '.');

          if (item.length > 1 && !item.match(/^[0-9\s\.\-—]*$/) && !isNaN(parseFloat(price))) {
            newItems.push({ id: currentItemId++, item: item, price: parseFloat(price).toFixed(2) });
            calculatedTotal += parseFloat(price);
          }
        }
      }

      let finalTotal = calculatedTotal.toFixed(2);

      if (detectedReceiptTotal !== null) {
          finalTotal = detectedReceiptTotal;
      } else if (detectedSubTotal !== null) {
          finalTotal = detectedSubTotal;
      }

      setUploadedReceipts(prevReceipts =>
        prevReceipts.map(receipt =>
          receipt.id === receiptId
            ? {
                ...receipt,
                total: `$${finalTotal}`,
                itemDetails: newItems,
                isProcessing: false,
              }
            : receipt
        )
      );

    } catch (error) {
      console.error(`OCR Error for ${receiptId}:`, error);
      alert(`Error performing OCR for ${receiptId}. Please try again or check the image quality and contents.`);
      setUploadedReceipts(prevReceipts =>
        prevReceipts.map(receipt =>
          receipt.id === receiptId
            ? { ...receipt, isProcessing: false, total: '$0.00', itemDetails: [] }
            : receipt
        )
      );
    } finally {
      setOcrQueue(prev => prev.filter(id => id !== receiptId));
      setCurrentOcrProcessId(null);
    }
  };

  const handleItemDetailChange = (receiptId, itemId, field, value) => {
    setUploadedReceipts(prevReceipts =>
      prevReceipts.map(receipt => {
        if (receipt.id === receiptId) {
          const updatedItemDetails = receipt.itemDetails.map(item =>
            item.id === itemId ? { ...item, [field]: value } : item
          );
          const newReceiptTotal = updatedItemDetails.reduce((sum, current) => {
            return sum + parseFloat(current.price || 0);
          }, 0).toFixed(2);
          return {
            ...receipt,
            itemDetails: updatedItemDetails,
            total: `$${newReceiptTotal}`
          };
        }
        return receipt;
      })
    );
  };

  const handleCollapseToggle = (receiptId) => {
    setUploadedReceipts(prevReceipts =>
      prevReceipts.map(receipt =>
        receipt.id === receiptId
          ? { ...receipt, isCollapsed: !receipt.isCollapsed }
          : receipt
      )
    );
  };

  const handleRequestAddressChange = (event) => {
    setRequestAddress(event.target.value);
  };

  const handleTitleChange = (event) => {
    setTitle(event.target.value);
  };

  const handleOpenRequest = () => {
    alert('Open Request (functionality not available on single page)');
  };

  const handleCalculate = () => {
    alert(`Grand Total recalculated: $${grandTotal}`);
  };

  const handleCreateRequest = () => {
    if (isAnyOcrLoading || ocrQueue.length > 0) {
      alert("Please wait for all receipts to finish processing before creating the request.");
      return;
    }

    const finalRequestData = {
      title,
      grandTotal: `$${grandTotal}`,
      allReceipts: uploadedReceipts.map(({ id, fileName, total, itemDetails }) => ({
        id,
        fileName,
        total,
        itemDetails,
      })),
      requestAddress,
      timestamp: new Date().toLocaleString()
    };
    console.log("Final Request Data:", finalRequestData);
    alert('Request created (check console for data). This is a single-page app.');

    setUploadedReceipts([]);
    setOcrQueue([]);
    setCurrentOcrProcessId(null);
    setRequestAddress('');
    setTitle('');
  };

  return (
    <>
      {/* Injecting styles directly */}
      <style>{appGlobalStyles}</style>
      
      <div className="App" style={{ display: 'flex', justifyContent: 'center', padding: '20px', minHeight: '100vh', boxSizing: 'border-box' }}>
        <div style={{
          border: '2px solid black',
          padding: '20px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          width: '800px',
          position: 'relative',
          alignItems: 'flex-start',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
          boxSizing: 'border-box'
        }}>
          <h1 style={{ marginBottom: '10px', alignSelf: 'center' }}>AnonExpense</h1>

          <input
            type="text"
            placeholder="title"
            value={title}
            onChange={handleTitleChange}
            style={{ width: 'calc(50% - 20px)', padding: '10px', border: '1px solid black', borderRadius: '5px' }}
            disabled={isAnyOcrLoading}
          />

          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `1px ${isDragging ? 'dashed blue' : 'solid black'}`,
              borderRadius: '5px',
              padding: '10px',
              width: 'calc(50% - 20px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s ease-in-out'
            }}>
            <label htmlFor="receipt-upload" style={{ cursor: 'pointer', padding: '5px' }}>
              {isAnyOcrLoading ? `Processing ${ocrQueue.length + (currentOcrProcessId ? 1 : 0)} receipts...` : (isDragging ? 'Drop your images here!' : 'Drag & drop or click to upload multiple receipts')}
            </label>
            <input
              id="receipt-upload"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              multiple
              style={{ display: 'none' }}
            />
            {uploadedReceipts.map(receipt => (
              <img
                key={receipt.id}
                src={receipt.imageUrl}
                alt={`Receipt Preview ${receipt.fileName}`}
                style={{ maxWidth: '100%', maxHeight: '100px', marginTop: '10px', border: '1px solid lightgray' }}
              />
            ))}
            {isAnyOcrLoading && <p style={{ marginTop: '10px', color: 'blue' }}>Extracting text, please wait...</p>}
            {ocrQueue.length > 0 && !isAnyOcrLoading && (
              <p style={{ marginTop: '5px', color: 'gray' }}>{ocrQueue.length} receipts waiting for processing...</p>
            )}
          </div>

          <input
            type="text"
            placeholder="request address"
            value={requestAddress}
            onChange={handleRequestAddressChange}
            style={{ width: 'calc(50% - 20px)', padding: '10px', border: '1px solid black', borderRadius: '5px' }}
            disabled={isAnyOcrLoading}
          />

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleOpenRequest} style={{ padding: '8px 15px', border: '1px solid black', borderRadius: '5px', background: 'white', cursor: 'pointer' }} disabled={isAnyOcrLoading}>
              open requests
            </button>
            <button onClick={handleCalculate} style={{ padding: '8px 15px', border: '1px solid black', borderRadius: '5px', background: 'white', cursor: 'pointer' }} disabled={isAnyOcrLoading}>
              calculate
            </button>
            <span style={{ marginLeft: '20px' }}>total: </span>
            <input
              type="text"
              value={`$${grandTotal}`}
              readOnly
              style={{ border: 'none', borderBottom: '1px solid black', outline: 'none', width: '80px', textAlign: 'left' }}
            />
          </div>

          <div style={{
            position: 'absolute',
            right: '20px',
            top: '20px',
            border: '2px solid blue',
            padding: '15px',
            borderRadius: '10px',
            width: '300px',
            minHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            overflowY: 'auto'
          }}>
            <h2>result statement</h2>
            {uploadedReceipts.length === 0 && !isAnyOcrLoading && (
              <p style={{ textAlign: 'center', marginTop: '20px' }}>Upload receipts to see extracted items.</p>
            )}
            {uploadedReceipts.map(receipt => (
              <div key={receipt.id} style={{ border: '1px solid #eee', borderRadius: '5px', marginBottom: '10px', overflow: 'hidden' }}>
                <div
                  onClick={() => handleCollapseToggle(receipt.id)}
                  style={{
                    padding: '10px',
                    background: '#f9f9f9',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 'bold'
                  }}
                >
                  <span>{receipt.fileName} ({receipt.isProcessing ? 'Processing...' : receipt.total || 'N/A'})</span>
                  <span>{receipt.isCollapsed ? '▼' : '▲'}</span>
                </div>

                {!receipt.isCollapsed && (
                  <div style={{ padding: '10px' }}>
                    {receipt.isProcessing ? (
                      <p>Extracting items for this receipt...</p>
                    ) : receipt.itemDetails.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Item</th>
                            <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receipt.itemDetails.map(item => (
                            <tr key={item.id}>
                              <td style={{ padding: '8px' }}>
                                <input
                                  type="text"
                                  value={item.item}
                                  onChange={(e) => handleItemDetailChange(receipt.id, item.id, 'item', e.target.value)}
                                  style={{ border: 'none', width: '100%', outline: 'none' }}
                                />
                              </td>
                              <td style={{ padding: '8px' }}>
                                <input
                                  type="text"
                                  value={item.price}
                                  onChange={(e) => handleItemDetailChange(receipt.id, item.id, 'price', e.target.value)}
                                  style={{ border: 'none', width: '100%', outline: 'none', textAlign: 'right' }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>No items extracted or error occurred for this receipt.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {uploadedReceipts.length > 0 && (
              <div style={{
                marginTop: '15px',
                paddingTop: '10px',
                borderTop: '2px solid #ccc',
                fontWeight: 'bold',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>Grand Total:</span>
                <span>${grandTotal}</span>
              </div>
            )}
            <button onClick={handleCreateRequest} style={{ padding: '10px 20px', border: '1px solid blue', borderRadius: '5px', background: 'white', cursor: 'pointer', marginTop: '15px' }} disabled={isAnyOcrLoading || ocrQueue.length > 0}>
              create request
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;

// To make this runnable directly in an HTML file (for example):
// 1. Save this entire content as `ReceiptOcrApp.tsx` (or .jsx if not using TypeScript features explicitly beyond JSX)
// 2. Create an HTML file like this:
/*
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt OCR App</title>
    <script src="https://unpkg.com/react@19.1.0/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@19.1.0/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
    </head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>

    <script type="text/babel" data-presets="react">
        // Paste the entire content of ReceiptOcrApp.tsx (this file) here,
        // OR if saved as a separate file and your server can serve it:
        // import App from './ReceiptOcrApp.tsx'; // (This import won't work directly in browser like this without a module system)

        // For a truly single HTML file experience without a server, you'd paste the JS/TSX code here:

        // --- Start of pasted ReceiptOcrApp.tsx content (excluding this comment block) ---

        // (The App component code as defined above, starting with its imports if they were not global,
        // but since React is global from CDN, we'd use that. Tesseract is imported inside App)

        // Example: Assume 'App' component and 'appGlobalStyles' const are defined directly above or pasted in.
        // If you paste the whole file content here, `App` will be defined.

        // --- End of pasted ReceiptOcrApp.tsx content ---

        const StrictApp = () => (
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
        
        const container = document.getElementById('root');
        const root = ReactDOM.createRoot(container);
        root.render(<StrictApp />);
    </script>
</body>
</html>
*/