const fs = require('fs');

function memoizeComponent(file, compName, signature) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('export const ' + compName + ' = React.memo')) {
    console.log(compName + ' already memoized.');
    return;
  }
  
  if (!content.includes(signature)) {
    console.log('Signature not found in ' + file + ':\n' + signature);
    return;
  }
  
  content = content.replace(signature, signature.replace(' = (', ' = React.memo(('));
  content = content.trimEnd();
  if (content.endsWith('};')) {
    content = content.slice(0, -2) + '});\n';
  } else if (content.endsWith('};\\n')) {
     content = content.slice(0, -3) + '});\n';
  } else {
     content += '\n// Note: Expected }; at EOF';
  }
  fs.writeFileSync(file, content);
  console.log(compName + ' wrapped with React.memo');
}

memoizeComponent('components/HomeView.tsx', 'HomeView', 'export const HomeView: React.FC<HomeViewProps> = ({ user, onNavigate, onExplore, budgetItems = [], budgetLimit = 0 }) => {');
memoizeComponent('components/FlightView.tsx', 'FlightView', 'export const FlightView: React.FC<FlightViewProps> = ({ user, onViewCity, onTrackFlight }) => {');
memoizeComponent('components/CityView.tsx', 'CityView', 'export const CityView: React.FC<CityViewProps> = ({ onAddToBudget, initialCity = "Atlanta", onCityChange, theme = \'dark\' }) => {');
memoizeComponent('components/SocialView.tsx', 'SocialView', 'export const SocialView: React.FC = () => {');
memoizeComponent('components/ApolloView.tsx', 'ApolloView', 'export const ApolloView: React.FC<ApolloViewProps> = ({ userTier, onBack }) => {');
memoizeComponent('components/ItineraryView.tsx', 'ItineraryView', 'export const ItineraryView: React.FC<PlansViewProps> = ({ user }) => {');
memoizeComponent('components/AboutView.tsx', 'AboutView', 'export const AboutView: React.FC<AboutViewProps> = ({ currentUser, onUserUpdate, textSize, onTextSizeChange }) => {');
