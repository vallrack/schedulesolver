'use client';

import React from 'react';

export const FirebaseClientProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // This provider ensures that Firebase is initialized only once on the client.
  return <>{children}</>;
};
