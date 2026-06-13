import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const now = new Date();
  const matches = await prisma.match.findMany({
    where: {
      status: "SCHEDULED",
      date: { gte: now },
    },
    orderBy: { date: "asc" },
    take: 5,
    include: {
      homeTeam: true,
      awayTeam: true,
    },
  });

  for (const m of matches) {
    console.log(`ID:${m.id} | ${m.homeTeam.name} vs ${m.awayTeam.name} | ${m.date.toISOString()} | ${m.stage}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
