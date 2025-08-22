import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
interface TestDocumentUploadProps {
  bookingId: string;
}
export const TestDocumentUpload = ({
  bookingId
}: TestDocumentUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const {
    toast
  } = useToast();
  const handleTestUpload = async () => {
    setIsUploading(true);
    try {
      // Create a simple test file
      const testContent = 'This is a test document';
      const testFile = new File([testContent], 'test-document.txt', {
        type: 'text/plain'
      });
      const docId = uuidv4();
      const fileName = `${bookingId}/${docId}-test-document.txt`;

      // 1. Test storage upload
      const {
        data: uploadData,
        error: uploadError
      } = await supabase.storage.from('guest-documents').upload(fileName, testFile);
      if (uploadError) {
        console.error('❌ Storage upload failed:', uploadError);
        throw uploadError;
      }
      

      // 2. Test database insert
      const documentRecord = {
        booking_id: bookingId,
        file_name: testFile.name,
        file_path: fileName,
        extracted_data: {
          test: true
        },
        processing_status: 'completed'
      };
      
      const {
        data: dbData,
        error: dbError
      } = await supabase.from('uploaded_documents').insert(documentRecord).select();
      if (dbError) {
        console.error('❌ Database insert failed:', dbError);
        throw dbError;
      }
      
      toast({
        title: "Test successful!",
        description: "Document uploaded and saved successfully"
      });
    } catch (error) {
      console.error('❌ Test failed:', error);
      toast({
        title: "Test failed",
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };
  return <Card className="mt-4">
      
      
    </Card>;
};