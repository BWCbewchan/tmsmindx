'use client';

import { useState, useEffect } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import {
  calculateInputAssessmentScore,
  getAssessmentProfile,
  getCriteriaForProfile,
  INPUT_ASSESSMENT_PROFILES,
  normalizeAssessmentProfileId,
  type AssessmentProfileId,
} from '@/lib/hr-input-assessment';

interface TAAssessmentFormProps {
  candidateId: number;
  initialData?: any;
  onSuccess: () => void;
  onClose: () => void;
}

export default function TAAssessmentForm({ candidateId, initialData, onSuccess, onClose }: TAAssessmentFormProps) {
  const [type, setType] = useState<AssessmentProfileId>(INPUT_ASSESSMENT_PROFILES[0].id);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [totalScore, setTotalScore] = useState(0);
  const [isPassed, setIsPassed] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setType(normalizeAssessmentProfileId(initialData.assessment_type));
      setScores(initialData.criteria_scores || {});
      setTotalScore(initialData.total_score || 0);
      setIsPassed(initialData.is_passed);
      setNote(initialData.feedback_note || '');
    } else {
      const initialScores: Record<string, number> = {};
      getCriteriaForProfile(INPUT_ASSESSMENT_PROFILES[0].id).forEach(c => initialScores[c.key] = 0);
      setScores(initialScores);
    }
  }, [initialData]);

  const handleScoreChange = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newScores = { ...scores, [key]: numValue };
    setScores(newScores);

    const total = calculateInputAssessmentScore(type, newScores);
    setTotalScore(total);
    setIsPassed(total >= getAssessmentProfile(type).passingScore);
  };

  const handleTypeChange = (nextType: AssessmentProfileId) => {
    const nextScores: Record<string, number> = {};
    getCriteriaForProfile(nextType).forEach(c => {
      nextScores[c.key] = scores[c.key] || 0;
    });
    const total = calculateInputAssessmentScore(nextType, nextScores);
    setType(nextType);
    setScores(nextScores);
    setTotalScore(total);
    setIsPassed(total >= getAssessmentProfile(nextType).passingScore);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/onboarding/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          assessment_type: type,
          total_score: totalScore,
          is_passed: isPassed,
          feedback_note: note,
          criteria_scores: scores,
        }),
      });

      if (!res.ok) throw new Error('Có lỗi xảy ra khi lưu đánh giá.');
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Đánh giá ứng viên" onClose={onClose}>
      <div className="space-y-6 p-1">
        {/* Assessment Type */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-gray-500">Loại đánh giá</label>
          <select 
            value={type} 
            onChange={(e) => handleTypeChange(e.target.value as AssessmentProfileId)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            {INPUT_ASSESSMENT_PROFILES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <p className="text-[11px] font-semibold text-gray-400">
            Ngưỡng đạt: {getAssessmentProfile(type).passingScore} điểm. {getAssessmentProfile(type).description}
          </p>
        </div>

        {/* Criteria Scores */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase text-gray-500">Chấm điểm chi tiết (Thang điểm 1-5)</label>
          <div className="grid grid-cols-1 gap-3">
            {getCriteriaForProfile(type).map(c => (
              <div key={c.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-700">{c.label}</span>
                  <span className="text-[10px] text-gray-400">Trọng số: {c.weight}% · {c.group}</span>
                </div>
                <input 
                  type="number" 
                  min="0" max="5" step="0.1"
                  value={scores[c.key] || 0}
                  onChange={(e) => handleScoreChange(c.key, e.target.value)}
                  className="w-20 p-2 text-right bg-white border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase">Tổng điểm quy đổi</p>
            <p className="text-2xl font-black text-blue-900">{totalScore}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500">Kết quả:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isPassed} 
                onChange={(e) => setIsPassed(e.target.checked)} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              <span className="ml-3 text-sm font-bold text-gray-700">{isPassed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
            </label>
          </div>
        </div>

        {/* Feedback */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-gray-500">Ghi chú / Nhận xét</label>
          <textarea 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="Nhập nhận xét chi tiết về ứng viên..."
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2 border border-red-100">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="h-4 w-4" /> Lưu đánh giá</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
