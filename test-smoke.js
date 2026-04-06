// Simple smoke tests for Next.js app
import http from 'http';

const host = "localhost";
const port = 3001;

async function runTests() {
  console.log("🚀 Starting smoke tests for mashenin Next.js app...");

  try {
    // Test 1: Main page
    console.log("📄 Testing main page...");
    const response1 = await fetch(`http://${host}:${port}/`);
    const html1 = await response1.text();

    if (!html1.includes("mashenin") || !html1.includes("Голосовые комнаты")) {
      throw new Error("Main page missing expected content");
    }
    console.log("✅ Main page works");

    // Test 2: Rooms page
    console.log("🏠 Testing rooms page...");
    const response2 = await fetch(`http://${host}:${port}/rooms`);
    const html2 = await response2.text();

    if (!html2.includes("Комнаты") || !html2.includes("Пока нет комнат")) {
      throw new Error("Rooms page missing expected content");
    }
    console.log("✅ Rooms page works");

    // Test 3: Navigation links exist
    console.log("🧭 Testing navigation...");
    if (!html1.includes('href="/rooms"') ||
        !html1.includes('href="/friends"') ||
        !html1.includes('href="/events"')) {
      throw new Error("Navigation links missing");
    }
    console.log("✅ Navigation works");

    // Test 4: SSR indicators
    console.log("⚡ Testing SSR...");
    if (!html1.includes('"__N_SSP":true') || !html2.includes('"__N_SSP":true')) {
      throw new Error("SSR not working properly");
    }
    console.log("✅ SSR working");

    console.log("\n🎉 All smoke tests passed!");
    console.log("✨ Next.js migration successful!");

  } catch (error) {
    console.error("❌ Smoke test failed:", error.message);
    process.exit(1);
  }
}

runTests();