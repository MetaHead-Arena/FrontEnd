// app/page.tsx
"use client";

import { useRouter } from "next/navigation"; // use 'next/router' for Pages Router
import { useEffect, useState } from "react";
import { useAccount } from "wagmi"; // Assuming you're using wagmi
import CustomConnectButton from "../src/ui/CustomConnectButton";

export default function Home() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (isConnected && !redirecting) {
      setRedirecting(true);
      router.push("/game");
    }
  }, [isConnected]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-3xl font-bold">Welcome to HeadBall Game</h1>
      <CustomConnectButton />
    </div>
  );
}
