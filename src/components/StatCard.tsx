interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
  icon?: React.ReactNode;
}

const colorMap = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
};

export default function StatCard({ title, value, subtitle, color = 'blue', icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4">
      {icon && (
        <div className={`${colorMap[color]} p-3 rounded-lg text-white flex-shrink-0`}>
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
