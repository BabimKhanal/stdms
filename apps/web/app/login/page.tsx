import { Suspense } from "react";
import { LoginForm } from "../../components/login-form";
export default function LoginPage() { return <Suspense fallback={<div className="min-h-screen bg-[#f4f7fb]" />}><LoginForm /></Suspense>; }
