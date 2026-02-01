'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/init';
import { useAppDispatch } from '@/store/hooks';
import { setUser, setInitialized } from '@/store/authSlice';

export function useAuthListener() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        dispatch(
          setUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified,
          })
        );
      } else {
        dispatch(setUser(null));
      }
      dispatch(setInitialized(true));
    });

    return () => unsubscribe();
  }, [dispatch]);
}
