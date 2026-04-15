
import React from 'react';
import { BookOpen, Code, Database, Cpu, Zap, Activity, Shield, Globe, Terminal, Layers, Share2, GitBranch } from 'lucide-react';

const Documentation: React.FC = () => {
  const sections = [
    {
      title: "System Architecture",
      icon: <Layers className="text-blue-400" size={20} />,
      content: "OPTIMA follows a Service-Component-Context architecture. Services handle mathematical kernels (TOPSIS, Nash, Markov), Contexts manage global state (Alerts), and Components handle the high-density presentation layer.",
      details: [
        "React 18 + Vite for high-performance rendering",
        "Tailwind CSS for utility-first responsive design",
        "Lucide React for consistent iconography",
        "Recharts for real-time data visualization"
      ]
    },
    {
      title: "EV Network Optimization",
      icon: <Zap className="text-yellow-400" size={20} />,
      content: "The EV Optimizer uses a multi-criteria decision-making (MCDM) approach to rank charging stations based on user preferences and grid constraints.",
      details: [
        "TOPSIS Algorithm: Ranks stations by similarity to an ideal solution",
        "Nash Equilibrium: Models strategic interaction between grid and vehicles",
        "Dynamic Throttling: Adjusts speeds based on live and predicted demand",
        "Surge Pricing: Predictive cost adjustments based on 6H demand forecasts"
      ]
    },
    {
      title: "Energy Grid Intelligence",
      icon: <Activity className="text-emerald-400" size={20} />,
      content: "Monitors regional grid stability using stochastic modeling and information theory to prevent failures and optimize distribution.",
      details: [
        "Markov Chain States: Predicts Low, Medium, and High load transitions",
        "Shannon Entropy: Quantifies system disorder and stability risk",
        "Pareto Optimization: Balances cost, comfort, and efficiency goals",
        "Historical Retrospective: 24H analysis of state probability shifts"
      ]
    },
    {
      title: "Data Flow & Integration",
      icon: <Share2 className="text-purple-400" size={20} />,
      content: "Data flows from real-time telemetry simulations and external APIs (TomTom) through mathematical services into the visual dashboard.",
      details: [
        "Telemetry Ingestion: Simulated 3s update cycle for live metrics",
        "API Integration: TomTom Traffic & Search for infrastructure tracking",
        "Alert Propagation: Global context-based notification system",
        "Sensitivity Analysis: Real-time recalculation of model stability"
      ]
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="relative p-8 rounded-2xl bg-gradient-to-br from-[#151619] to-[#0a0b0d] border border-white/10 overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <BookOpen size={200} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <BookOpen className="text-blue-400" size={24} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Technical Documentation</h2>
          </div>
          <p className="text-white/60 max-w-2xl leading-relaxed">
            Welcome to the OPTIMA Mission Control technical manual. This guide outlines the architectural flow, 
            mathematical models, and data integration patterns that power the optimization suite.
          </p>
        </div>
      </div>

      {/* Grid Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, i) => (
          <div key={i} className="bg-[#151619] p-6 rounded-xl border border-white/10 hover:border-white/20 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
                {section.icon}
              </div>
              <h3 className="font-bold text-white/90 uppercase tracking-wider text-sm">{section.title}</h3>
            </div>
            <p className="text-xs text-white/50 leading-relaxed mb-6">
              {section.content}
            </p>
            <ul className="space-y-3">
              {section.details.map((detail, j) => (
                <li key={j} className="flex items-start gap-3 text-[10px] font-mono text-white/40">
                  <div className="mt-1 w-1 h-1 bg-blue-500 rounded-full" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Mathematical Kernel Section */}
      <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden">
        <div className="p-4 bg-white/5 border-b border-white/10 flex items-center gap-2">
          <Terminal size={16} className="text-emerald-400" />
          <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Mathematical Kernels</span>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>TOPSIS Analysis</span>
              </div>
              <p className="text-[10px] text-white/40 font-mono leading-relaxed">
                Calculates the Euclidean distance between alternatives and the positive/negative ideal solutions to determine relative closeness.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span>Nash Equilibrium</span>
              </div>
              <p className="text-[10px] text-white/40 font-mono leading-relaxed">
                Iteratively computes best-response strategies in a payoff matrix to identify stable operational points for grid-EV interaction.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                <span>Markov Modeling</span>
              </div>
              <p className="text-[10px] text-white/40 font-mono leading-relaxed">
                Utilizes a 3x3 transition matrix to simulate state-to-state movement, providing a probabilistic forecast of grid load evolution.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* End-to-End Workflow Section */}
      <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden">
        <div className="p-4 bg-white/5 border-b border-white/10 flex items-center gap-2">
          <Share2 size={16} className="text-blue-400" />
          <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">End-to-End Workflow</span>
        </div>
        <div className="p-8">
          <div className="relative">
            {/* Vertical Line for Mobile, Horizontal for Desktop */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-white/5 md:-translate-x-1/2" />
            
            <div className="space-y-12 relative">
              {[
                {
                  step: "01",
                  title: "Data Ingestion",
                  desc: "Real-time telemetry streams (Frequency, Load, Voltage) are ingested every 3 seconds alongside external infrastructure data from TomTom APIs.",
                  icon: <Database size={16} className="text-blue-400" />
                },
                {
                  step: "02",
                  title: "Stochastic Prediction",
                  desc: "The Markov Chain engine processes current load states to calculate transition probabilities for the next 6-24 hour window.",
                  icon: <Cpu size={16} className="text-purple-400" />
                },
                {
                  step: "03",
                  title: "Optimization Logic",
                  desc: "MCDM (TOPSIS) and Game Theory (Nash) models evaluate the best operational strategies based on dynamic user weights and grid stability constraints.",
                  icon: <Zap size={16} className="text-yellow-400" />
                },
                {
                  step: "04",
                  title: "Action & Alerting",
                  desc: "Optimized recommendations are dispatched to the UI, while critical stability drops trigger immediate global alerts and automated throttling.",
                  icon: <Shield size={16} className="text-emerald-400" />
                }
              ].map((item, idx) => (
                <div key={idx} className={`flex flex-col md:flex-row items-start md:items-center gap-8 ${idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                  <div className="flex-1 md:text-right w-full">
                    {idx % 2 === 0 && (
                      <div className="hidden md:block">
                        <h4 className="text-sm font-bold text-white/90 mb-2 uppercase tracking-wider">{item.title}</h4>
                        <p className="text-[10px] text-white/40 font-mono leading-relaxed max-w-xs ml-auto">{item.desc}</p>
                      </div>
                    )}
                    {idx % 2 !== 0 && (
                      <div className="md:hidden">
                        <h4 className="text-sm font-bold text-white/90 mb-2 uppercase tracking-wider">{item.title}</h4>
                        <p className="text-[10px] text-white/40 font-mono leading-relaxed">{item.desc}</p>
                      </div>
                    )}
                  </div>

                  <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-[#0a0b0d] border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                    <div className="text-[10px] font-bold font-mono text-blue-400">{item.step}</div>
                  </div>

                  <div className="flex-1 w-full">
                    {idx % 2 !== 0 && (
                      <div className="hidden md:block">
                        <h4 className="text-sm font-bold text-white/90 mb-2 uppercase tracking-wider">{item.title}</h4>
                        <p className="text-[10px] text-white/40 font-mono leading-relaxed max-w-xs">{item.desc}</p>
                      </div>
                    )}
                    {idx % 2 === 0 && (
                      <div className="md:hidden">
                        <h4 className="text-sm font-bold text-white/90 mb-2 uppercase tracking-wider">{item.title}</h4>
                        <p className="text-[10px] text-white/40 font-mono leading-relaxed">{item.desc}</p>
                      </div>
                    )}
                    {/* Mobile only content for even steps */}
                    {idx % 2 === 0 && (
                      <div className="md:hidden">
                        <h4 className="text-sm font-bold text-white/90 mb-2 uppercase tracking-wider">{item.title}</h4>
                        <p className="text-[10px] text-white/40 font-mono leading-relaxed">{item.desc}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
        <div className="flex items-center gap-3">
          <Shield className="text-blue-400" size={16} />
          <span className="text-[10px] font-mono text-blue-400/80 uppercase tracking-widest">System Integrity Verified: v2.4.0</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-white/20">
          <div className="flex items-center gap-1">
            <GitBranch size={12} />
            <span>main</span>
          </div>
          <div className="flex items-center gap-1">
            <Globe size={12} />
            <span>asia-east1</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
