import {
  Activity,
  ArrowRight,
  Bell,
  BellOff,
  CalendarDays,
  Check,
  CircleHelp,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileText,
  Files,
  Globe,
  GripVertical,
  History,
  LoaderCircle,
  Pencil,
  Pill,
  RefreshCw,
  RotateCcw,
  Settings,
  Shield,
  Siren,
  Stethoscope,
  Table2,
  Trash2,
  TriangleAlert,
  Upload,
  Wifi,
  X,
} from 'lucide-react';

function createIcon(Icon) {
  return function AppIcon({ className = 'w-5 h-5' }) {
    return (
      <Icon
        className={className}
        strokeWidth={2}
        aria-hidden="true"
        focusable="false"
      />
    );
  };
}

export const DownloadIcon = createIcon(Download);
export const UploadIcon = createIcon(Upload);
export const SyncIcon = createIcon(RefreshCw);
export const InstallIcon = createIcon(Download);
export const CloseIcon = createIcon(X);
export const EditIcon = createIcon(Pencil);
export const GripIcon = createIcon(GripVertical);
export const TrashIcon = createIcon(Trash2);
export const ResetIcon = createIcon(RotateCcw);
export const EyeIcon = createIcon(Eye);
export const FileStackIcon = createIcon(Files);
export const TableIcon = createIcon(Table2);
export const ReportIcon = createIcon(FileText);
export const StethoscopeIcon = createIcon(Stethoscope);
export const CalendarIcon = createIcon(CalendarDays);
export const ActivityIcon = createIcon(Activity);
export const HistoryIcon = createIcon(History);
export const SettingsIcon = createIcon(Settings);
export const HelpIcon = createIcon(CircleHelp);
export const ArrowRightIcon = createIcon(ArrowRight);

export const CheckIcon = createIcon(Check);
export const WarningIcon = createIcon(TriangleAlert);
export const BellIcon = createIcon(Bell);
export const BellOffIcon = createIcon(BellOff);
export const PillIcon = createIcon(Pill);
export const ShieldIcon = createIcon(Shield);
export const WifiIcon = createIcon(Wifi);
export const GlobeIcon = createIcon(Globe);
export const LoaderIcon = createIcon(LoaderCircle);
export const ClockIcon = createIcon(Clock);
export const SirenIcon = createIcon(Siren);
export const ClipboardListIcon = createIcon(ClipboardList);
