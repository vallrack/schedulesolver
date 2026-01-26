'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError } from 'firebase/firestore';
import { useMemo } from 'react';

export function useCollection<T>(query: Query<DocumentData> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const memoizedQuery = useMemo(() => query, [query]);

  useEffect(() => {
    if (!memoizedQuery) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      memoizedQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        setData(docs);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
        console.error("Error fetching collection:", err);
      }
    );

    return () => unsubscribe();
  }, [memoizedQuery]);

  return { data, loading, error };
}
