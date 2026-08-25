import { useEffect } from "react";
import { useAuth} from "@clerk/react";
import * as Sentry from "@sentry/react";

export function SentryUserSync(){
  const { isLoaded, userId}  = useAuth();

  useEffect(() => {
    if(!isLoaded) return;
    Sentry.setUser(userId ? {id: userId} : null)
  }, [isLoaded, userId]);

  return;
}