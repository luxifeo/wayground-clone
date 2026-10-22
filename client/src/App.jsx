import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from './lib/auth.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import Home from './pages/admin/Home.jsx';
import Library from './pages/admin/Library.jsx';
import Explore from './pages/admin/Explore.jsx';
import Reports from './pages/admin/Reports.jsx';
import ReportDetail from './pages/admin/ReportDetail.jsx';
import AssessmentNew from './pages/admin/AssessmentNew.jsx';
import QuizEditor from './pages/admin/QuizEditor.jsx';
import QuizDetail from './pages/admin/QuizDetail.jsx';
import StartSession from './pages/admin/StartSession.jsx';
import Worksheet from './pages/admin/Worksheet.jsx';
import AdventureCreate from './pages/admin/AdventureCreate.jsx';
import ReadingCreate from './pages/admin/ReadingCreate.jsx';
import HostSession from './pages/host/HostSession.jsx';
import Join from './pages/play/Join.jsx';
import Game from './pages/play/Game.jsx';

const A = (el) => <RequireAuth>{el}</RequireAuth>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/join" element={<Join />} />
      <Route path="/join/:code" element={<Join />} />
      <Route path="/play/:token" element={<Game />} />
      <Route path="/admin" element={A(<Home />)} />
      <Route path="/admin/library" element={A(<Library />)} />
      <Route path="/admin/explore" element={A(<Explore />)} />
      <Route path="/admin/reports" element={A(<Reports />)} />
      <Route path="/admin/reports/:id" element={A(<ReportDetail />)} />
      <Route path="/admin/assessment/new" element={A(<AssessmentNew />)} />
      <Route path="/admin/reading/new" element={A(<ReadingCreate />)} />
      <Route path="/admin/quiz/:id" element={A(<QuizDetail />)} />
      <Route path="/admin/quiz/:id/edit" element={A(<QuizEditor />)} />
      <Route path="/admin/quiz/:id/start" element={A(<StartSession />)} />
      <Route path="/admin/quiz/:id/worksheet" element={A(<Worksheet />)} />
      <Route path="/admin/quiz/:id/adventure" element={A(<AdventureCreate />)} />
      <Route path="/admin/quiz/:id/reading" element={A(<ReadingCreate />)} />
      <Route path="/host/:id" element={A(<HostSession />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
