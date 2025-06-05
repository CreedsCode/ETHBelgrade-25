interface ApiResponse {
    timestamp: string;
    content: {
      public: {
        "@context": string;
        "@id": string;
        "@type": string;
        name: string;
        description: string;
        "PayerAddress": string;
        "total paid": string;
        "paid expenses": string;
      }
    };
    result: string;
  }
  
  interface PaymentData {
    payerAddress: string;
    totalPaid: string;
    paidExpenses: string;
  }
  
  const API_URL = 'http://localhost:3000/published-assets'; // TODO: Update this URL to the correct API endpoint
  
  export const fetchPaymentData = async (): Promise<PaymentData[]> => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ApiResponse = await response.json();
      
      // Assuming the API returns a single object matching ApiResponse for this dashboard
      // If it returns an array of such objects, this transformation will need adjustment.
      const result: PaymentData[] = [{
        payerAddress: data.content.public["PayerAddress"],
        totalPaid: data.content.public["total paid"],
        paidExpenses: data.content.public["paid expenses"]
      }];
      
      return result;
    } catch (error) {
      console.error('Error fetching payment data:', error);
      // Rethrow or handle as appropriate for your error strategy
      throw error;
    }
  }; 