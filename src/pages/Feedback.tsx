import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Eye, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export function Feedback() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.role ?? "viewer", PERMISSIONS.FEEDBACK_MANAGE);
  const utils = trpc.useUtils();

  const [qOpen, setQOpen] = useState(false);
  const [qForm, setQForm] = useState({ title: "", description: "" });
  const [questions, setQuestions] = useState<{ id: string; text: string; type: "text" | "rating" | "choice" | "yes_no"; required: boolean; options?: string[] }[]>([]);
  const [viewQ, setViewQ] = useState<number | null>(null);

  const { data: questionnaires } = trpc.feedback.questionnaires.useQuery();
  const { data: responses } = trpc.feedback.responses.useQuery(
    { questionnaireId: viewQ ?? 0 },
    { enabled: viewQ !== null }
  );

  const createQ = trpc.feedback.createQuestionnaire.useMutation({
    onSuccess: () => { setQOpen(false); setQForm({ title: "", description: "" }); setQuestions([]); utils.feedback.questionnaires.invalidate(); toast.success("Questionnaire created"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteQ = trpc.feedback.deleteQuestionnaire.useMutation({
    onSuccess: () => { utils.feedback.questionnaires.invalidate(); toast.success("Questionnaire deleted"); },
  });
  const updateQ = trpc.feedback.updateQuestionnaire.useMutation({
    onSuccess: () => { utils.feedback.questionnaires.invalidate(); toast.success("Updated"); },
  });

  const addQuestion = () => {
    setQuestions(prev => [...prev, { id: crypto.randomUUID(), text: "", type: "text", required: true }]);
  };

  const updateQuestion = (id: string, field: string, value: any) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Feedback</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Manage questionnaires and view responses</p>
          </div>
          {canManage && (
            <Dialog open={qOpen} onOpenChange={setQOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#C73E1D]"><Plus className="mr-1 h-4 w-4" />New Questionnaire</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto bg-white">
                <DialogHeader><DialogTitle className="font-serif text-xl">Create Questionnaire</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={qForm.title} onChange={e => setQForm(p => ({ ...p, title: e.target.value }))} /></div>
                  <div><Label>Description</Label><Input value={qForm.description} onChange={e => setQForm(p => ({ ...p, description: e.target.value }))} /></div>
                  <div className="space-y-2">
                    <Label>Questions</Label>
                    {questions.map((q, idx) => (
                      <div key={q.id} className="flex gap-2 rounded-lg border border-[#E8E0D8] p-2">
                        <div className="flex-1 space-y-1">
                          <Input placeholder={`Question ${idx + 1}`} value={q.text} onChange={e => updateQuestion(q.id, "text", e.target.value)} className="text-sm" />
                          <div className="flex gap-2">
                            <select value={q.type} onChange={e => updateQuestion(q.id, "type", e.target.value)} className="rounded border px-2 py-1 text-xs">
                              <option value="text">Text</option>
                              <option value="rating">Rating (1-5)</option>
                              <option value="choice">Multiple Choice</option>
                              <option value="yes_no">Yes / No</option>
                            </select>
                            <label className="flex items-center gap-1 text-xs">
                              <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, "required", e.target.checked)} /> Required
                            </label>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeQuestion(q.id)}><Trash2 className="h-4 w-4 text-[#D32F2F]" /></Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={addQuestion}><Plus className="mr-1 h-3 w-3" />Add Question</Button>
                  </div>
                  <Button
                    onClick={() => createQ.mutate({ title: qForm.title, description: qForm.description, questions })}
                    disabled={!qForm.title || questions.length === 0 || createQ.isPending}
                    className="w-full bg-[#2E7D32]"
                  >
                    {createQ.isPending ? "Creating..." : "Create Questionnaire"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {questionnaires?.map(q => (
            <Card key={q.id} className="border-[#E8E0D8]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-serif text-lg">{q.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    {q.isActive ? (
                      <span className="rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-xs text-[#2E7D32]">Active</span>
                    ) : (
                      <span className="rounded-full bg-[#8D8A87]/10 px-2 py-0.5 text-xs text-[#8D8A87]">Inactive</span>
                    )}
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => updateQ.mutate({ id: q.id, isActive: !q.isActive })}>
                          <CheckCircle className="h-4 w-4 text-[#2E7D32]" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this questionnaire?")) deleteQ.mutate({ id: q.id }); }}>
                          <Trash2 className="h-4 w-4 text-[#D32F2F]" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {q.description && <p className="text-sm text-[#8D8A87]">{q.description}</p>}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#8D8A87]">
                  {Array.isArray(q.questions) ? q.questions.length : JSON.parse(q.questions as string)?.length ?? 0} questions
                </p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setViewQ(q.id)}>
                  <Eye className="mr-1 h-3 w-3" /> View Responses
                </Button>
              </CardContent>
            </Card>
          ))}
          {(!questionnaires || questionnaires.length === 0) && (
            <p className="col-span-2 text-center text-sm text-[#8D8A87]">No questionnaires yet.</p>
          )}
        </div>

        {/* Responses view */}
        {viewQ !== null && responses && (
          <Card className="border-[#D4A854]">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg">Responses</CardTitle>
            </CardHeader>
            <CardContent>
              {responses.length === 0 ? (
                <p className="text-sm text-[#8D8A87]">No responses yet.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {responses.map((r, idx) => (
                    <div key={r.id} className="rounded-lg border border-[#E8E0D8] p-3">
                      <p className="text-xs text-[#8D8A87]">#{idx + 1} · {r.respondentName ?? "Anonymous"} · {new Date(r.createdAt).toLocaleDateString()}</p>
                      <div className="mt-2 space-y-1">
                        {Object.entries(r.answers as Record<string, string>).map(([qid, ans]) => (
                          <p key={qid} className="text-sm"><span className="text-[#8D8A87]">{qid}:</span> {ans}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
