import React, { useState, useEffect } from 'react';
import API from '../api/axios';
import { 
  UserPlus, 
  CreditCard, 
  CheckCircle2, 
  ArrowRight, 
  UserCheck, 
  Search, 
  Clock, 
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';

const StaffDashboard = () => {
  const gymName = localStorage.getItem('gym_name') || 'Unknown Gym';
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    membership_tier: 'Standard',
    duration_months: '1',
    transaction_ref: ''
  });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allMembers, setAllMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await API.get('/members');
      setAllMembers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setIsError(false);
    setMessage('');

    try {
      const res = await API.post('/members', formData);
      setMessage(`SUCCESS: MEMBER_CREATED | TRANSACTION_REF: ${res.data.transaction_ref}`);
      fetchMembers();
      setFormData({ full_name: '', email: '', phone: '', membership_tier: 'Standard', duration_months: '1', transaction_ref: '' });
    } catch (err) {
      setIsError(true);
      const apiMessage = err.response?.data?.error;

      if (err.response?.status === 409) {
        setMessage(apiMessage || 'REJECTED: EMAIL_ALREADY_REGISTERED');
      } else if (apiMessage) {
        setMessage(apiMessage);
      } else {
        setMessage('SYSTEM_ERROR: REGISTRATION_FAILED');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMembers = allMembers.filter(m => 
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const needsRenewal = (member) => {
    const daysLeft = Number(member.days_left);
    return member.is_expiring === true || (Number.isFinite(daysLeft) && daysLeft <= 5);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6 md:p-12 font-sans selection:bg-white selection:text-black">
      <header className="max-w-6xl mx-auto mb-12 flex justify-between items-end border-b border-[#222] pb-6">
        <div>
          <p className="text-[10px] font-mono text-gray-500 tracking-[0.3em] uppercase mb-2">Front_Desk_Terminal</p>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase">Staff <span className="text-gray-500 underline decoration-1 underline-offset-4">Portal</span></h1>
          <p className="mt-3 text-[10px] font-mono text-gray-500 uppercase tracking-[0.25em]">Gym: {gymName}</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5 space-y-8">
          <section className="bg-[#151515] p-8 border border-[#222]">
            <h2 className="text-xs font-black tracking-[0.2em] uppercase mb-8 flex items-center gap-2">
              <UserPlus size={16} /> New Enrollment
            </h2>
            <form onSubmit={handleRegister} className="space-y-8">
              <div className="group">
                <label className="block text-[10px] text-gray-600 uppercase mb-2">Full Name</label>
                <input type="text" className="w-full bg-transparent border-b border-[#333] py-2 outline-none focus:border-white transition-all font-mono text-sm uppercase" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} required />
              </div>
              <div className="group">
                <label className="block text-[10px] text-gray-600 uppercase mb-2">Email Address</label>
                <input type="email" className="w-full bg-transparent border-b border-[#333] py-2 outline-none focus:border-white transition-all font-mono text-sm" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div className="group">
                <label className="block text-[10px] text-gray-600 uppercase mb-2">Phone Number</label>
                <input type="tel" className="w-full bg-transparent border-b border-[#333] py-2 outline-none focus:border-white transition-all font-mono text-sm" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="09xx xxx xxx" />
              </div>
              <div className="group">
                <label className="block text-[10px] text-gray-600 uppercase mb-2">Membership Tier</label>
                <select className="w-full bg-transparent border-b border-[#333] py-2 outline-none focus:border-white transition-all font-mono text-sm appearance-none cursor-pointer" value={formData.membership_tier} onChange={(e) => setFormData({...formData, membership_tier: e.target.value})}>
                  <option value="Standard" className="bg-[#151515]">Standard (800 ETB)</option>
                  <option value="Elite" className="bg-[#151515]">Elite (1500 ETB)</option>
                </select>
              </div>
              <div className="group">
                <label className="block text-[10px] text-gray-600 uppercase mb-2">Duration (Months)</label>
                <input type="number" min="1" className="w-full bg-transparent border-b border-[#333] py-2 outline-none focus:border-white transition-all font-mono text-sm" value={formData.duration_months} onChange={(e) => setFormData({...formData, duration_months: e.target.value})} required />
              </div>
              <div className="group">
                <label className="block text-[10px] text-gray-600 uppercase mb-2">Transaction ID</label>
                <input type="text" className="w-full bg-transparent border-b border-white py-2 outline-none font-mono text-lg tracking-widest uppercase placeholder:text-[#333]" value={formData.transaction_ref} onChange={(e) => setFormData({...formData, transaction_ref: e.target.value})} required placeholder="REF_CODE" />
              </div>
              <button disabled={isSubmitting} className="w-full bg-white text-black font-black py-4 uppercase text-xs tracking-[0.3em] hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {isSubmitting ? 'PROCESSING' : 'INITIALIZE_REGISTRATION'} <ArrowRight size={14} />
              </button>
            </form>
          </section>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-white" size={18} />
            <input type="text" placeholder="FILTER_RECORDS..." className="w-full bg-[#151515] border border-[#222] py-4 pl-12 pr-4 text-[10px] font-mono outline-none focus:border-gray-500 transition-all uppercase" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="bg-[#151515] border border-[#222] max-h-[600px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#1a1a1a] border-b border-[#222] z-10">
                <tr className="text-[9px] font-black uppercase text-gray-600 tracking-widest">
                  <th className="p-4">Member_Identity</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Validity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className={`group hover:bg-[#1c1c1c] ${m.is_expiring ? 'bg-red-950/5' : ''}`}>
                    <td className="p-4">
                      <p className="text-xs font-bold uppercase tracking-tight">{m.full_name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[8px] text-gray-600 font-mono italic">#{m.id.substring(0,4)}</span>
                        <span className="text-[8px] text-blue-500 font-mono bg-blue-500/5 px-1 border border-blue-500/20">{m.total_months_active || 0}M_TENURE</span>
                        {needsRenewal(m) && <span className="text-[8px] font-black uppercase px-1 border border-red-500/40 bg-red-500/10 text-red-400">RENEWAL_DUE</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 border ${m.status === 'Active' ? 'border-green-900/50 text-green-500 bg-green-950/10' : 'border-red-900/50 text-red-500 bg-red-950/10'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <p className={`text-[10px] font-mono ${m.is_expiring ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                        {m.days_left < 0 ? 'VOID' : `${m.days_left}D_REMAINING`}
                      </p>
                      <div className="mt-2 flex justify-end gap-2">
                        {needsRenewal(m) && <p className="text-[7px] text-red-500 animate-pulse uppercase tracking-[0.2em] font-black">!_RENEW_NOW_!</p>}
                        {needsRenewal(m) && (
                          <button
                            type="button"
                            onClick={() => startRenewal(m)}
                            className="text-[8px] font-black uppercase px-2 py-1 border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all"
                          >
                            Renew
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {message && (
        <div className={`fixed bottom-8 right-8 px-8 py-4 font-black text-[10px] tracking-widest shadow-2xl z-50 italic flex items-center gap-3 transition-all ${isError ? 'bg-red-600 text-white' : 'bg-white text-black'}`}>
          {isError ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          {message}
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;