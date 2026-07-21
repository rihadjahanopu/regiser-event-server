export default async function handler(req: any, res: any) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('../src/index');
    const app = mod.default?.default ?? mod.default ?? mod;
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel Crash Error:", error);
    res.status(500).json({
      error: "Vercel Execution Crash",
      message: error.message,
      stack: error.stack
    });
  }
}
