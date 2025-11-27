import { useState, useEffect } from 'react';
import { Clock, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  getRecentProjects,
  loadProject,
  deleteProject,
  cleanupExpiredProjects,
  extendProjectExpiration
} from '../../utils/projectStorage';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function RecentProjects({ onProjectLoad }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProject, setLoadingProject] = useState(null);

  const setImage = useAnnotatorStore((state) => state.setImage);
  const setText = useAnnotatorStore((state) => state.setText);
  const setBoxes = useAnnotatorStore((state) => state.setBoxes);
  const setLetterSpacing = useAnnotatorStore((state) => state.setLetterSpacing);
  const setCharPadding = useAnnotatorStore((state) => state.setCharPadding);
  const setKerningAdjustments = useAnnotatorStore((state) => state.setKerningAdjustments);
  const setBaselines = useAnnotatorStore((state) => state.setBaselines);
  const setAngledBaselines = useAnnotatorStore((state) => state.setAngledBaselines);
  const setImageRotation = useAnnotatorStore((state) => state.setImageRotation);
  const setImageFilters = useAnnotatorStore((state) => state.setImageFilters);
  const setLevelsAdjustment = useAnnotatorStore((state) => state.setLevelsAdjustment);

  // Load recent projects on mount
  useEffect(() => {
    loadRecentProjects();
  }, []);

  const loadRecentProjects = async () => {
    setLoading(true);
    try {
      // Clean up expired projects first
      await cleanupExpiredProjects();
      // Then get remaining projects
      const recentProjects = await getRecentProjects();
      setProjects(recentProjects);
    } catch (error) {
      console.error('Failed to load recent projects:', error);
    }
    setLoading(false);
  };

  const handleLoadProject = async (projectId) => {
    setLoadingProject(projectId);
    try {
      const projectData = await loadProject(projectId);

      // Load image from file
      if (projectData.imageFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            // Set all state
            setImage(img, projectData.imageFile);
            setText(projectData.text || '');
            setBoxes(projectData.boxes || []);
            setLetterSpacing(projectData.letterSpacing || 0);
            setCharPadding(projectData.charPadding || 0);
            setKerningAdjustments(projectData.kerningAdjustments || {});
            setBaselines(projectData.baselines || []);
            setAngledBaselines(projectData.angledBaselines || []);
            setImageRotation(projectData.imageRotation || 0);
            setImageFilters(projectData.imageFilters || {
              invert: false,
              brightness: 100,
              contrast: 100,
              shadows: 0,
              highlights: 0,
              grayscale: 100
            });
            setLevelsAdjustment(projectData.levelsAdjustment || null);

            // Store project ID for future saves
            useAnnotatorStore.setState({ currentProjectId: projectData.id });

            // Notify parent
            if (onProjectLoad) {
              onProjectLoad(projectData.id);
            }
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(projectData.imageFile);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      alert('Failed to load project: ' + error.message);
    }
    setLoadingProject(null);
  };

  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation();
    if (confirm('Delete this project? This cannot be undone.')) {
      try {
        await deleteProject(projectId);
        setProjects(projects.filter(p => p.id !== projectId));
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const handleExtendExpiration = async (e, projectId) => {
    e.stopPropagation();
    try {
      await extendProjectExpiration(projectId);
      await loadRecentProjects(); // Refresh the list
    } catch (error) {
      console.error('Failed to extend expiration:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--te-gray-dark)'
      }}>
        Loading recent projects...
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--te-gray-dark)',
        textAlign: 'center',
        padding: 'var(--padding-md)'
      }}>
        <Clock style={{ width: '32px', height: '32px', marginBottom: '12px', opacity: 0.5 }} />
        <p style={{ marginBottom: '4px', fontVariationSettings: "'wght' 500" }}>No recent projects</p>
        <p className="te-small-caps" style={{ fontSize: '10px' }}>
          Your work will appear here
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      overflowY: 'auto',
      padding: '4px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px'
      }}>
        <span className="te-small-caps" style={{ color: 'var(--te-gray-dark)' }}>
          Recent Projects ({projects.length})
        </span>
        <button
          onClick={loadRecentProjects}
          className="te-btn te-btn-ghost"
          style={{ padding: '4px', height: '24px', width: '24px' }}
          title="Refresh list"
        >
          <RefreshCw style={{ width: '12px', height: '12px' }} />
        </button>
      </div>

      {projects.map((project) => (
        <div
          key={project.id}
          onClick={() => handleLoadProject(project.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--te-gray-mid)',
            cursor: loadingProject === project.id ? 'wait' : 'pointer',
            background: loadingProject === project.id ? 'var(--te-gray-light)' : 'var(--te-white)',
            transition: 'all 0.15s ease',
            opacity: loadingProject === project.id ? 0.7 : 1
          }}
          onMouseEnter={(e) => {
            if (loadingProject !== project.id) {
              e.currentTarget.style.background = 'var(--te-gray-light)';
              e.currentTarget.style.borderColor = 'var(--te-green)';
            }
          }}
          onMouseLeave={(e) => {
            if (loadingProject !== project.id) {
              e.currentTarget.style.background = 'var(--te-white)';
              e.currentTarget.style.borderColor = 'var(--te-gray-mid)';
            }
          }}
        >
          {/* Thumbnail - Full width */}
          <div style={{
            width: '100%',
            height: '80px',
            borderRadius: 'var(--radius-xs)',
            overflow: 'hidden',
            background: 'var(--te-gray-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '8px'
          }}>
            {project.thumbnailUrl ? (
              <img
                src={project.thumbnailUrl}
                alt={project.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <span style={{ fontSize: '24px', opacity: 0.3 }}>📷</span>
            )}
          </div>

          {/* Info - Below thumbnail */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <div style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <div style={{
                fontVariationSettings: "'wght' 500",
                fontSize: '12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {project.name}
              </div>

              {project.text && (
                <div style={{
                  fontSize: '11px',
                  color: 'var(--te-gray-dark)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  "{project.text}"
                </div>
              )}

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '2px'
              }}>
                <span className="te-small-caps" style={{
                  fontSize: '9px',
                  color: 'var(--te-gray-dark)'
                }}>
                  {project.boxCount} boxes
                </span>

                <span className="te-small-caps" style={{
                  fontSize: '9px',
                  color: 'var(--te-gray-dark)'
                }}>
                  {formatDate(project.updatedAt)}
                </span>
              </div>

              {/* Expiration warning */}
              {project.isExpiringSoon && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '2px'
                }}>
                  <AlertTriangle style={{
                    width: '10px',
                    height: '10px',
                    color: 'var(--te-orange)'
                  }} />
                  <span style={{
                    fontSize: '9px',
                    color: 'var(--te-orange)',
                    fontVariationSettings: "'wght' 500"
                  }}>
                    Expires in {project.daysUntilExpiry}d
                  </span>
                  <button
                    onClick={(e) => handleExtendExpiration(e, project.id)}
                    className="te-btn te-btn-ghost"
                    style={{
                      padding: '2px 4px',
                      height: '16px',
                      fontSize: '8px',
                      marginLeft: '4px'
                    }}
                    title="Extend by 14 days"
                  >
                    Extend
                  </button>
                </div>
              )}
            </div>

            {/* Delete button */}
            <button
              onClick={(e) => handleDeleteProject(e, project.id)}
              className="te-btn te-btn-ghost"
              style={{
                padding: '4px',
                height: '24px',
                width: '24px',
                flexShrink: 0,
                opacity: 0.5
              }}
              title="Delete project"
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.color = 'var(--te-orange)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.5';
                e.currentTarget.style.color = 'inherit';
              }}
            >
              <Trash2 style={{ width: '12px', height: '12px' }} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
