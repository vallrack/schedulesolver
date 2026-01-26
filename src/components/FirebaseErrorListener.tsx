'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export default function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.error("Caught a Firestore permission error:", error);
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: (
          <div className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
            <p className="text-xs text-white">The following request was denied by Firestore Security Rules:</p>
            <pre className="mt-2 w-[340px] overflow-x-auto rounded-md bg-slate-950 p-2">
              <code className="text-white text-xs">{JSON.stringify(error.context, null, 2)}</code>
            </pre>
          </div>
        ),
      });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null;
}
