'use client';
import { ErrorState } from '@/components/status';
export default function Error({reset}:{reset:()=>void}){return <ErrorState message="The workspace encountered an unexpected error." retry={reset}/>;}
