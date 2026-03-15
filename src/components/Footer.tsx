import { links } from '@/lib/site';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#0b0f10]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-bold">Copyright © {year} Virtual Cleveland ARTCC - All Rights Reserved.</div>
            <div className="mt-2 max-w-2xl text-xs leading-relaxed text-white/60">
              For Flight Simulation Use Only. This site is not intended for real world navigation, and not affiliated with any governing
              aviation body. All content contained is approved only for use on the VATSIM network.
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/70">
              <a href="/feedback" className="hover:text-white">Feedback</a>
              <span className="text-white/30">•</span>
              <a href="/privacy" className="hover:text-white">Privacy Policy</a>
              <span className="text-white/30">•</span>
              <a href={links.vatsimFacility ?? 'https://vatsim.net'} target="_blank" rel="noreferrer" className="hover:text-white">
                VATSIM
              </a>
              <span className="text-white/30">•</span>
              <a href="https://vatusa.net" target="_blank" rel="noreferrer" className="hover:text-white">
                VATUSA
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:max-w-sm">
            <div className="text-sm font-bold">The Virtual Cleveland ARTCC stands with the LGBTQIA+ community on VATSIM.</div>
            <p className="mt-2 text-xs leading-relaxed text-white/65">
              You are welcome here, and have our support. We recognize it is important to maintain a welcoming community and environment to all
              members.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
