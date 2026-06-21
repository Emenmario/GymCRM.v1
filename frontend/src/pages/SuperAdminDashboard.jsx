import React, { useEffect, useMemo, useState } from 'react';
import API from '../api/axios';
import {
  Activity,
  ArrowRight,
  BadgeDollarSign,
  Building2,
  Layers3,
  LogOut,
  Shield,
  Users,
} from 'lucide-react';

const initialFormState = {
  gym_name: '',
  owner_username: '',
  initial_password: '',
};

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 2,
});

const SuperAdminDashboard = () => {
  const [analytics, setAnalytics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const response = await API.get('/super/analytics');
      setAnalytics(response.data || []);
    } catch (error) {
      setToast({
        tone: 'error',
        title: 'Platform sync failed',
        detail: error.response?.data?.error || 'Unable to load tenant ledger.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const summary = useMemo(() => {
    return analytics.reduce(
      (accumulator, gym) => {
        accumulator.platformRevenue += Number(gym.platform_earnings || 0);
        accumulator.totalGyms += 1;
        accumulator.totalActiveMembers += Number(gym.active_member_count || 0);
        return accumulator;
      },
      {
        platformRevenue: 0,
        totalGyms: 0,
        totalActiveMembers: 0,
      }
    );
  }, [analytics]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await API.post('/super/gyms', formData);
      setToast({
        tone: 'success',
        title: 'Tenant provisioned',
        detail: `Owner ${response.data.owner.username} created with temporary password ${response.data.temporary_password}`,
      });
      setFormData(initialFormState);
      await loadAnalytics();
    } catch (error) {
      setToast({
        tone: 'error',
        title: 'Provisioning failed',
        detail: error.response?.data?.error || 'Tenant generation could not be completed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6 md:p-12 font-sans selection:bg-white selection:text-black">
      <header className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#222] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500 mb-2 tracking-[0.3em] uppercase">
            <Activity size={14} className="text-green-500" /> SYSTEM_ROOT
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none">
            Platform <span className="text-gray-500 underline decoration-1 underline-offset-8">Terminal</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-400">
            Tenant orchestration, revenue monitoring, and facility onboarding from a single global control plane.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="px-4 py-2 bg-[#151515] border border-[#222] rounded-sm text-right min-w-[120px]">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Gyms</p>
            <p className="text-xl font-bold font-mono text-teal-300">{summary.totalGyms}</p>
          </div>
          <button
            type="button"
            onClick={loadAnalytics}
            className="px-4 py-2 bg-[#151515] border border-[#222] rounded-sm text-[10px] font-black uppercase tracking-widest hover:border-white transition-all"
          >
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="p-3 bg-red-950/20 border border-red-900/50 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded-sm"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="max-w-7xl mx-auto mb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          icon={<BadgeDollarSign size={18} />}
          label="Platform Revenue"
          value={moneyFormatter.format(summary.platformRevenue)}
          accent="text-teal-300"
        />
        <MetricCard
          icon={<Building2 size={18} />}
          label="Registered Gyms"
          value={String(summary.totalGyms)}
          accent="text-gray-100"
        />
        <MetricCard
          icon={<Users size={18} />}
          label="Active Members"
          value={String(summary.totalActiveMembers)}
          accent="text-emerald-300"
        />
      </section>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 space-y-10">
          <section className="bg-[#151515] p-8 border border-[#222] relative group">
            <div className="absolute top-0 left-0 w-1 h-0 bg-white group-hover:h-full transition-all duration-500" />
            <h2 className="text-xs font-black tracking-[0.3em] uppercase mb-8 flex items-center gap-3">
              <Layers3 size={16} /> New Gym
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Field label="Gym Name" value={formData.gym_name} onChange={handleChange('gym_name')} placeholder="North Star Fitness" />
              <Field label="Owner Username" value={formData.owner_username} onChange={handleChange('owner_username')} placeholder="owner_northstar" />
              <Field label="Initial Password" value={formData.initial_password} onChange={handleChange('initial_password')} placeholder="Auto-generate if blank" type="text" />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-white text-black py-4 font-black uppercase text-xs tracking-[0.3em] hover:invert transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Processing' : 'Create Tenant'}
                <ArrowRight size={14} />
              </button>
            </form>
          </section>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <section>
            <h2 className="text-xs font-black tracking-[0.3em] uppercase mb-6 flex items-center gap-3 text-teal-300">
              <Shield size={16} /> Ledger
            </h2>

            <div className="bg-[#151515] border border-[#222] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#1a1a1a] border-b border-[#222]">
                  <tr className="text-[10px] font-black uppercase text-gray-600 tracking-widest">
                    <th className="p-6">Gym</th>
                    <th className="p-6 text-center">Members</th>
                    <th className="p-6 text-right">Processed</th>
                    <th className="p-6 text-right">Platform</th>
                    <th className="p-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {isLoading ? (
                    <tr>
                      <td colSpan="5" className="h-24 flex items-center justify-center text-gray-700 text-[10px] font-mono uppercase tracking-[0.4em]">
                        Loading
                      </td>
                    </tr>
                  ) : analytics.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="h-24 flex items-center justify-center text-gray-700 text-[10px] font-mono uppercase tracking-[0.4em]">
                        Empty
                      </td>
                    </tr>
                  ) : (
                    analytics.map((gym) => (
                      <tr key={gym.gym_id} className="group hover:bg-[#1c1c1c] transition-colors">
                        <td className="p-6">
                          <p className="text-sm font-black uppercase tracking-tight">{gym.gym_name}</p>
                          <p className="text-[9px] font-mono text-gray-600 mt-1">#{String(gym.gym_id).substring(0, 6)}</p>
                        </td>
                        <td className="p-6 text-center font-mono text-sm text-gray-200">{Number(gym.active_member_count || 0)}</td>
                        <td className="p-6 text-right font-mono text-sm text-gray-200">{Number(gym.total_transactions_processed || 0)}</td>
                        <td className="p-6 text-right font-mono text-sm text-teal-300">{moneyFormatter.format(Number(gym.platform_earnings || 0))}</td>
                        <td className="p-6 text-center">
                          <span className="px-3 py-1 border border-green-900/50 text-[9px] font-black uppercase tracking-widest text-green-500 bg-green-900/10">
                            {gym.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-white text-black px-10 py-5 font-black text-xs tracking-[0.4em] shadow-2xl z-50 uppercase italic" role="status" aria-live="polite">
          {toast.detail}
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ icon, label, value, accent }) => (
  <div className="px-4 py-2 bg-[#151515] border border-[#222] rounded-sm text-right min-w-[120px]">
    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</p>
    <div className={`mt-1 flex items-center justify-between gap-3 ${accent}`}>
      <span className="text-xl font-bold font-mono">{value}</span>
      <span>{icon}</span>
    </div>
  </div>
);

const Field = ({ label, type = 'text', value, onChange, placeholder }) => (
  <label className="block group">
    <span className="mb-2 block text-[10px] uppercase tracking-[0.3em] text-gray-500 group-focus-within:text-white">{label}</span>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-transparent border-b border-[#333] py-2 outline-none focus:border-white transition-all font-mono text-sm placeholder:text-gray-700"
      required={label !== 'Initial Password'}
    />
  </label>
);

export default SuperAdminDashboard;