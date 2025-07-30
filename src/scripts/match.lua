// src/scripts/match.lua
local key = KEYS[1]
local user = ARGV[1]
redis.call('RPUSH', key, user)
local len = tonumber(redis.call('LLEN', key))
if len < 2 then return nil end
local a = redis.call('LPOP', key)
local b = redis.call('LPOP', key)
if a == user then a, b = b, a end
return a