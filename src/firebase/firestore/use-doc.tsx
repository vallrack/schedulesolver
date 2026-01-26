'use client';

import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, DocumentReference, DocumentData, FirestoreError } from 'firebase/firestore';

export function useDoc<T>(docRef: DocumentReference<DocumentData> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const memoizedDocRef = useMemo(() => docRef, [docRef]);

  useEffect(() => {
    if (!memoizedDocRef) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
        console.error("Error fetching document:", err);
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef]);

  return { data, loading, error };
}
