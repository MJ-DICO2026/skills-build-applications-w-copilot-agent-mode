import { isValidObjectId } from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw httpError(400, 'Invalid activity input');
  }

  const { userId, teamId, type, minutes } = input as {
    userId?: unknown;
    teamId?: unknown;
    type?: unknown;
    minutes?: unknown;
  };

  if (
    typeof userId !== 'string'
    || typeof teamId !== 'string'
    || !isValidObjectId(userId)
    || !isValidObjectId(teamId)
  ) {
    throw httpError(400, 'userId and teamId must be valid ObjectIds');
  }
  if (typeof type !== 'string' || type.trim().length === 0) {
    throw httpError(400, 'type is required');
  }
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    throw httpError(400, 'minutes must be a positive number');
  }

  const [user, team] = await Promise.all([
    User.findById(userId).lean(),
    Team.findById(teamId).lean(),
  ]);
  if (!user) {
    throw httpError(404, 'User not found');
  }
  if (!team) {
    throw httpError(404, 'Team not found');
  }

  const activity = await Activity.create({
    user: userId,
    team: teamId,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
  return activity.toObject();
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw httpError(400, 'Invalid team input');
  }

  const { name, mascot, members } = input as {
    name?: unknown;
    mascot?: unknown;
    members?: unknown;
  };

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw httpError(400, 'name is required');
  }
  if (typeof mascot !== 'string' || mascot.trim().length === 0) {
    throw httpError(400, 'mascot is required');
  }

  let memberIds: string[] = [];
  if (members !== undefined) {
    if (!Array.isArray(members) || members.some((member) => typeof member !== 'string' || !isValidObjectId(member))) {
      throw httpError(400, 'members must contain valid ObjectIds');
    }
    memberIds = [...new Set(members)];

    const existingMembers = await User.find({ _id: { $in: memberIds } }).select('_id').lean();
    if (existingMembers.length !== memberIds.length) {
      throw httpError(404, 'One or more team members were not found');
    }
  }

  const team = await Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: memberIds,
  });
  return team.toObject();
}

export async function getLeaderboard() {
  const totals = await Activity.aggregate([
    {
      $group: {
        _id: '$team',
        totalPoints: { $sum: '$points' },
      },
    },
    { $sort: { totalPoints: -1 } },
    {
      $lookup: {
        from: Team.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'team',
      },
    },
    { $unwind: '$team' },
  ]);

  return totals.map((entry, index) => ({
    teamName: entry.team.name as string,
    totalPoints: entry.totalPoints as number,
    rank: index + 1,
  }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) {
    throw httpError(404, 'User not found');
  }

  const recentActivity = await Activity.findOne({ user: user._id })
    .sort({ occurredAt: -1 })
    .lean();

  const activityType = typeof recentActivity?.type === 'string'
    ? recentActivity.type.toLowerCase()
    : '';
  const goalFocus = typeof user.fitnessGoal === 'string'
    ? user.fitnessGoal.toLowerCase()
    : '';
  const activityFocus = ['run', 'running', 'cycle', 'cycling'].includes(activityType)
    ? 'endurance'
    : ['strength', 'strength training'].includes(activityType)
      ? 'strength'
      : '';
  const preferredFocuses = [...new Set([goalFocus, activityFocus].filter(Boolean))];

  let workout = null;
  for (const focus of preferredFocuses) {
    workout = await Workout.findOne({ focus }).lean();
    if (workout) {
      break;
    }
  }
  if (!workout) {
    return [];
  }

  const reason = activityType && activityFocus === workout.focus
    ? `Matches your ${goalFocus || workout.focus} goal and recent ${activityType} activity`
    : `Matches your ${workout.focus} fitness goal`;

  return [{ ...workout, reason }];
}

export { User };
